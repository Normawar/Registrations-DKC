
'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, Download, ClipboardCheck, FileText, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AppLayout } from '@/components/app-layout';
import { OrganizerGuard } from '@/components/auth-guard';

export default function USCFDataParserPage() {
  const [inputData, setInputData] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseUSCFData = (text: string) => {
    try {
      // Clean up the text and split into tokens
      const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const allTokens = cleanText.split(/[\t\n]/).map(token => token.trim()).filter(token => token.length > 0);
      
      const parsed: any[] = [];
      let currentPlayer: any = {};
      let expectingRank = true;
      
      // Define regex patterns for different data types
      const patterns = {
        rank: /^\d+$/,
        uscfId: /^\d{8,9}$/,
        expirationDate: /^\d{4}-\d{2}-\d{2}$|^20\d{2}-\d{2}-\d{2}$/,
        name: /^(GM|IM|FM|WGM|WIM|WFM|CM|WCM|NM|WNM|MR\.|MS\.|MRS\.)?[\s]*[A-Z][A-Z\s\.\-']+$/i,
        state: /^[A-Z]{2,3}$|^(TX|CA|NY|FL|WI|MO|ARM|HUN|NED|IND|MGL|SRB|VA|ON|QC|TAM|NLE|CAN)$/,
        rating: /^\d{3,4}$/,
        datePublished: /^20\d{2}-\d{2}-\d{2}$/,
        events: /^[1-9]\d*$/,
        tournamentId: /^\d{12}$/
      };
      
      let i = 0;
      
      // Skip header section
      while (i < allTokens.length && 
             (allTokens[i].includes('Rank') || 
              allTokens[i].includes('USCF') || 
              allTokens[i].includes('Name') || 
              allTokens[i].includes('State') || 
              allTokens[i].includes('Rating') || 
              allTokens[i].includes('Date') || 
              allTokens[i].includes('Published') || 
              allTokens[i].includes('Events') || 
              allTokens[i].includes('Last') || 
              allTokens[i].includes('Event') ||
              allTokens[i].includes('Exp'))) {
        i++;
      }
      
      // Process tokens sequentially
      while (i < allTokens.length) {
        const token = allTokens[i];
        
        // Skip obvious non-data
        if (token.includes('DUMMY ID') || token.length > 100) {
          i++;
          continue;
        }
        
        // Look for rank (start of new player record)
        if (patterns.rank.test(token) && expectingRank) {
          // Save previous player if complete
          if (currentPlayer.rank && currentPlayer.name && currentPlayer.memberID) {
            parsed.push({...currentPlayer});
          }
          
          // Start new player
          currentPlayer = { rank: parseInt(token) };
          expectingRank = false;
          i++;
          continue;
        }
        
        // Look for USCF ID
        if (patterns.uscfId.test(token) && currentPlayer.rank && !currentPlayer.memberID) {
          currentPlayer.memberID = token;
          i++;
          continue;
        }
        
        // Look for expiration date
        if (patterns.expirationDate.test(token) && currentPlayer.memberID && !currentPlayer.expirationDate) {
          currentPlayer.expirationDate = token;
          i++;
          continue;
        }
        
        // Look for name (with potential title)
        if (patterns.name.test(token) && currentPlayer.memberID && !currentPlayer.name) {
          let fullName = token;
          let title = '';
          
          // Extract chess titles
          const titleMatch = fullName.match(/^(GM|IM|FM|WGM|WIM|WFM|CM|WCM|NM|WNM)\s+(.+)/i);
          if (titleMatch) {
            title = titleMatch[1].toUpperCase();
            fullName = titleMatch[2];
          }
          
          // Remove honorifics
          fullName = fullName.replace(/^(MR\.|MS\.|MRS\.)\s+/i, '');
          
          currentPlayer.name = fullName.trim();
          if (title) currentPlayer.title = title;
          i++;
          continue;
        }
        
        // Look for state
        if (patterns.state.test(token) && currentPlayer.name && !currentPlayer.state) {
          currentPlayer.state = token;
          i++;
          continue;
        }
        
        // Look for rating
        if (patterns.rating.test(token) && currentPlayer.name && !currentPlayer.rating) {
          currentPlayer.rating = parseInt(token);
          i++;
          continue;
        }
        
        // Look for date published
        if (patterns.datePublished.test(token) && currentPlayer.rating && !currentPlayer.datePublished) {
          currentPlayer.datePublished = token;
          i++;
          continue;
        }
        
        // Look for events count
        if (patterns.events.test(token) && currentPlayer.datePublished && !currentPlayer.events) {
          currentPlayer.events = parseInt(token);
          i++;
          continue;
        }
        
        // Look for tournament ID
        if (patterns.tournamentId.test(token) && currentPlayer.events && !currentPlayer.lastEvent) {
          currentPlayer.lastEvent = token;
          expectingRank = true; // Ready for next player
          i++;
          continue;
        }
        
        // If we can't categorize this token, move on
        i++;
      }
      
      // Don't forget the last player
      if (currentPlayer.rank && currentPlayer.name && currentPlayer.memberID) {
        parsed.push({...currentPlayer});
      }
      
      // Clean up and format results
      return parsed.map(player => ({
        name: player.name || '',
        memberID: player.memberID || '',
        rating: player.rating || '',
        state: player.state || '',
        title: player.title || '',
        expirationDate: player.expirationDate || '',
        lastEvent: player.lastEvent || ''
      }));
      
    } catch (err) {
      console.error('Parse error:', err);
      throw new Error('Failed to parse data. The format may be too complex for automatic parsing.');
    }
  };

  const parseUSCFDataSimple = (text: string) => {
    try {
      // Split into lines and look for patterns
      const lines = text.split('\n').map(line => line.trim()).filter(line => line);
      const parsed: any[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Look for lines that start with rank number followed by tab and USCF ID
        const rankMatch = line.match(/^(\d+)\s+(\d{8,9})\s*(.*)/);
        if (rankMatch) {
          const [, rank, memberID, rest] = rankMatch;
          
          // Try to extract other fields from the rest of the line and subsequent lines
          let name = '';
          let state = '';
          let rating = '';
          let title = '';
          
          // Look in current line and next few lines for additional data
          const searchLines = [rest, ...lines.slice(i + 1, i + 8)].filter(Boolean);
          
          for (const searchLine of searchLines) {
            // Look for name with title
            const nameMatch = searchLine.match(/(GM|IM|FM|WGM|WIM|WFM|CM|WCM)?\s*([A-Z][A-Z\s\.\-']+)/);
            if (nameMatch && !name) {
              title = nameMatch[1] || '';
              name = nameMatch[2].replace(/^(MR\.|MS\.|MRS\.)\s+/i, '').trim();
            }
            
            // Look for state
            const stateMatch = searchLine.match(/\b([A-Z]{2,3})\b/);
            if (stateMatch && !state && stateMatch[1].length <= 3) {
              state = stateMatch[1];
            }
            
            // Look for rating
            const ratingMatch = searchLine.match(/\b(\d{3,4})\b/);
            if (ratingMatch && !rating) {
              const potentialRating = parseInt(ratingMatch[1]);
              if (potentialRating >= 100 && potentialRating <= 3000) {
                rating = potentialRating.toString();
              }
            }
          }
          
          if (name && memberID) {
            parsed.push({
              name,
              memberID,
              rating,
              state,
              title,
              expirationDate: '',
              lastEvent: ''
            });
          }
        }
      }
      
      return parsed;
    } catch (err) {
      throw new Error('Failed to parse data with simple parser.');
    }
  };

  const parseUSCFDataWithFallback = (text: string) => {
    try {
      const result = parseUSCFData(text);
      if (result.length > 0) {
        return result;
      }
      // If main parser found nothing, try simple parser
      return parseUSCFDataSimple(text);
    } catch (err) {
      // If main parser fails, try simple parser
      try {
        return parseUSCFDataSimple(text);
      } catch (simpleErr) {
        throw new Error('Could not parse data with either parser method.');
      }
    }
  };

  const handleParse = () => {
    if (!inputData.trim()) {
      setError('Please enter some data to parse.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const parsed = parseUSCFDataWithFallback(inputData); // Use the new parser
      if (parsed.length === 0) {
        setError('No valid player data found. Please check the format.');
      } else {
        setParsedData(parsed);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setInputData(e.target?.result as string);
    };
    reader.readAsText(file);
  };

  const downloadCSV = () => {
    if (parsedData.length === 0) return;
    
    const headers = ['Name', 'Member_ID', 'Regular_Rating', 'State', 'Title', 'Expiration_Date', 'Last_Tournament_Date'];
    const csvContent = [
      headers.join(','),
      ...parsedData.map(player => [
        `"${player.name}"`,
        player.memberID,
        player.rating,
        player.state,
        player.title,
        player.expirationDate,
        player.lastEvent
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `uscf_players_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const sampleData = `Rank	USCF ID	Exp. Date	Name	State	Rating	Date Published	Events	Last Event
1	13999045	2099-12-31	GM AWONDER LIANG	WI	2762	2025-09-01	1	202401076382
2	17084025	2099-12-31	GM GRIGORIY OPARIN	MO	2727	2025-09-01	1	202401076382`;

  return (
    <OrganizerGuard>
        <AppLayout>
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-bold font-headline">USCF Data Parser</h1>
                <p className="text-muted-foreground">
                  Convert USCF affiliate or tournament data into a clean CSV format for analysis.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Data Input
                    </CardTitle>
                    <CardDescription>
                      Paste USCF data or upload a text file containing player information.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="data-input">Paste USCF Data</Label>
                      <Textarea
                        id="data-input"
                        placeholder="Paste your USCF affiliate or tournament data here..."
                        value={inputData}
                        onChange={(e) => setInputData(e.target.value)}
                        className="min-h-32 font-mono text-sm"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Upload File
                      </Button>
                      <Button 
                        onClick={() => setInputData(sampleData)}
                        variant="outline"
                      >
                        Load Sample
                      </Button>
                    </div>
                    
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".txt,.csv"
                      className="hidden"
                    />
                    
                    <Button 
                      onClick={handleParse} 
                      disabled={isLoading || !inputData.trim()}
                      className="w-full"
                    >
                      <ClipboardCheck className="h-4 w-4 mr-2" />
                      {isLoading ? 'Parsing...' : 'Parse Data'}
                    </Button>
                    
                    {error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Results Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="h-5 w-5" />
                      Parsed Results
                    </CardTitle>
                    <CardDescription>
                      {parsedData.length > 0 
                        ? `Found ${parsedData.length} players. Download as CSV below.`
                        : 'No data parsed yet.'
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {parsedData.length > 0 ? (
                      <div className="space-y-4">
                        <div className="max-h-64 overflow-y-auto border rounded-md p-3">
                          <div className="text-sm font-mono">
                            <div className="grid grid-cols-3 gap-2 font-semibold border-b pb-2 mb-2">
                              <span>Name</span>
                              <span>ID</span>
                              <span>Rating</span>
                            </div>
                            {parsedData.slice(0, 10).map((player, index) => (
                              <div key={index} className="grid grid-cols-3 gap-2 py-1 text-xs">
                                <span className="truncate" title={player.name}>
                                  {player.title && `${player.title} `}{player.name}
                                </span>
                                <span>{player.memberID}</span>
                                <span>{player.rating}</span>
                              </div>
                            ))}
                            {parsedData.length > 10 && (
                              <div className="text-xs text-muted-foreground mt-2">
                                ... and {parsedData.length - 10} more players
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <Button onClick={downloadCSV} className="w-full">
                          <Download className="h-4 w-4 mr-2" />
                          Download CSV ({parsedData.length} players)
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Parse data to see results here</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Format Help */}
              <Card>
                <CardHeader>
                  <CardTitle>Supported Data Format</CardTitle>
                  <CardDescription>
                    This tool works with tab-separated data from USCF affiliate reports or tournament exports.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-4 rounded-md font-mono text-sm">
                    <div className="text-xs text-muted-foreground mb-2">Expected format:</div>
                    <div>Rank&nbsp;&nbsp;&nbsp;&nbsp;USCF ID&nbsp;&nbsp;&nbsp;&nbsp;Exp. Date&nbsp;&nbsp;&nbsp;&nbsp;Name&nbsp;&nbsp;&nbsp;&nbsp;State&nbsp;&nbsp;&nbsp;&nbsp;Rating&nbsp;&nbsp;&nbsp;&nbsp;...</div>
                    <div>1&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;13999045&nbsp;&nbsp;&nbsp;&nbsp;2099-12-31&nbsp;&nbsp;&nbsp;&nbsp;GM AWONDER LIANG&nbsp;&nbsp;&nbsp;&nbsp;WI&nbsp;&nbsp;&nbsp;&nbsp;2762&nbsp;&nbsp;&nbsp;&nbsp;...</div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    The tool automatically extracts chess titles (GM, IM, FM, etc.) and cleans up player names.
                    It generates a CSV with columns: Name, Member_ID, Regular_Rating, State, Title, Expiration_Date, Last_Tournament_Date.
                  </p>
                </CardContent>
              </Card>
            </div>
        </AppLayout>
    </OrganizerGuard>
  );
}

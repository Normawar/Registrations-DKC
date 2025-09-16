
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
      const lines = text.trim().split('\n');
      const parsed: any[] = [];
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Split by tab characters (common in USCF data exports)
        const columns = line.split('\t').map(col => col.trim());
        
        // Skip header row if it exists
        if (columns[0] === 'Rank' || columns[0] === 'rank') continue;
        
        // Extract data based on typical USCF format
        if (columns.length >= 6) {
          const player = {
            rank: columns[0] || '',
            memberID: columns[1] || '',
            expirationDate: columns[2] || '',
            name: columns[3] || '',
            state: columns[4] || '',
            rating: columns[5] || '',
            datePublished: columns[6] || '',
            events: columns[7] || '',
            lastEvent: columns[8] || ''
          };
          
          // Clean up name to extract title
          let cleanName = player.name;
          let title = '';
          
          // Extract chess titles (GM, IM, FM, etc.)
          const titleMatch = cleanName.match(/^(GM|IM|FM|WGM|WIM|WFM|CM|WCM|NM|WNM)\s+(.+)/);
          if (titleMatch) {
            title = titleMatch[1];
            cleanName = titleMatch[2];
          }
          
          // Remove "MR." or "MS." prefixes
          cleanName = cleanName.replace(/^(MR\.|MS\.|MRS\.)\s+/i, '');
          
          parsed.push({
            name: cleanName,
            memberID: player.memberID,
            rating: player.rating,
            state: player.state,
            title: title,
            expirationDate: player.expirationDate,
            lastEvent: player.lastEvent
          });
        }
      }
      
      return parsed;
    } catch (err) {
      throw new Error('Failed to parse data. Please check the format.');
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
      const parsed = parseUSCFData(inputData);
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

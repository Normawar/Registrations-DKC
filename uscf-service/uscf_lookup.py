import requests
import time
from bs4 import BeautifulSoup
import re
from dataclasses import dataclass
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)

@dataclass
class USCFPlayer:
    """Data class to hold USCF player information"""
    uscf_id: str
    name: str
    rating_regular: Optional[int] = None
    rating_quick: Optional[int] = None
    state: Optional[str] = None
    expiration_date: Optional[str] = None

class USCFLookup:
    """
    USCF Player Lookup System using the HTTP approach
    """
    
    def __init__(self, rate_limit_seconds: float = 2.0):
        """
        Initialize the USCF lookup system
        
        Args:
            rate_limit_seconds: Minimum time between requests (conservative for production)
        """
        self.base_url = "http://www.uschess.org/datapage/player-search.php"
        self.session = requests.Session()
        
        # Browser-like headers
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
        })
        
        self.rate_limit = rate_limit_seconds
        self.last_request_time = 0
        
    def _rate_limit_delay(self):
        """Ensure we don't make requests too frequently"""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.rate_limit:
            time.sleep(self.rate_limit - time_since_last)
        self.last_request_time = time.time()
    
    def _make_request(self, search_term: str) -> Optional[str]:
        """
        Make a request to the USCF website
        
        Args:
            search_term: The search term (USCF ID or name)
            
        Returns:
            HTML content if successful, None if failed
        """
        self._rate_limit_delay()
        
        try:
            url = f"{self.base_url}?name={search_term}"
            logger.info(f"Searching for: {search_term}")
            
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            
            return response.text
            
        except requests.RequestException as e:
            logger.error(f"Request failed for search term {search_term}: {e}")
            return None
    
    def _format_name(self, raw_name: str) -> str:
        """
        Format name from USCF format to "lastName, firstName, middleName"
        
        Args:
            raw_name: Name as it appears in USCF (e.g., "MORENO, RYAN" or "SMITH, JOHN DAVID")
            
        Returns:
            Formatted name as "lastName, firstName, middleName"
        """
        try:
            if ',' not in raw_name:
                return raw_name.strip()
            
            # Split on comma to separate last name from first/middle names
            parts = raw_name.split(',', 1)
            last_name = parts[0].strip()
            remaining_names = parts[1].strip() if len(parts) > 1 else ""
            
            if not remaining_names:
                return last_name
            
            # Split the remaining names by spaces
            name_parts = remaining_names.split()
            
            if len(name_parts) == 1:
                # Only first name
                first_name = name_parts[0]
                return f"{last_name}, {first_name}"
            
            elif len(name_parts) >= 2:
                # First name and middle name(s)
                first_name = name_parts[0]
                middle_names = " ".join(name_parts[1:])
                return f"{last_name}, {first_name}, {middle_names}"
            
            else:
                return raw_name.strip()
                
        except Exception as e:
            logger.warning(f"Error formatting name '{raw_name}': {e}")
            return raw_name.strip()
    
    def _parse_rating(self, rating_text: str) -> Optional[int]:
        """
        Parse a rating string like "602/25" or "Unrated"
        
        Args:
            rating_text: The rating text from the HTML
            
        Returns:
            The numeric rating or None if unrated
        """
        if not rating_text or rating_text.strip().lower() == "unrated":
            return None
        
        # Extract the rating number (the part before the slash)
        match = re.match(r'^(\d+)', rating_text.strip())
        if match:
            return int(match.group(1))
        
        return None
    
    def _parse_player_data(self, html_content: str, search_term: str) -> Optional[USCFPlayer]:
        """
        Parse the HTML response to extract player information
        
        Args:
            html_content: Raw HTML from USCF website
            search_term: The original search term used
            
        Returns:
            USCFPlayer object if parsing successful, None otherwise
        """
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Check for Cloudflare protection or other blocks
            if "cloudflare" in html_content.lower() or "error 1003" in html_content.lower():
                logger.warning("Request blocked by Cloudflare protection")
                return None
            
            # Check if no players were found
            if "Players found: 0" in html_content or "No players found" in html_content:
                logger.info(f"No player found for search term: {search_term}")
                return None
            
            # Look for the player data table
            # Headers: USCF ID, Rating, Q Rtg, BL Rtg, OL R, OL Q, OL BL, State, Exp Date, Name
            rows = soup.find_all('tr')
            
            for row in rows:
                cells = row.find_all('td')
                if len(cells) >= 10:
                    
                    # Extract data from each cell
                    uscf_id_cell = cells[0].get_text(strip=True)
                    rating_cell = cells[1].get_text(strip=True)
                    quick_rating_cell = cells[2].get_text(strip=True)
                    state_cell = cells[7].get_text(strip=True)
                    exp_date_cell = cells[8].get_text(strip=True)
                    name_cell = cells[9].get_text(strip=True)
                    
                    # Validate that this looks like a USCF ID (7-8 digits)
                    if re.match(r'^\d{7,8}', uscf_id_cell):
                        
                        # Parse the ratings
                        regular_rating = self._parse_rating(rating_cell)
                        quick_rating = self._parse_rating(quick_rating_cell)
                        
                        # Clean up the data
                        uscf_id = uscf_id_cell.strip()
                        raw_name = name_cell.strip()
                        formatted_name = self._format_name(raw_name)
                        state = state_cell.strip() if state_cell.strip() else None
                        exp_date = exp_date_cell.strip() if exp_date_cell.strip() else None
                        
                        logger.info(f"Successfully parsed player: {formatted_name} (ID: {uscf_id})")
                        
                        return USCFPlayer(
                            uscf_id=uscf_id,
                            name=formatted_name,
                            rating_regular=regular_rating,
                            rating_quick=quick_rating,
                            state=state,
                            expiration_date=exp_date
                        )
            
            logger.warning(f"Could not find valid player data in HTML for search term: {search_term}")
            return None
            
        except Exception as e:
            logger.error(f"Failed to parse player data: {e}")
            return None
    
    def _parse_multiple_players(self, html_content: str, search_term: str) -> List[USCFPlayer]:
        """
        Parse HTML response that might contain multiple players
        
        Args:
            html_content: Raw HTML from USCF website
            search_term: The original search term used
            
        Returns:
            List of USCFPlayer objects found
        """
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            players = []
            
            # Check for Cloudflare protection or other blocks
            if "cloudflare" in html_content.lower() or "error 1003" in html_content.lower():
                logger.warning("Request blocked by Cloudflare protection")
                return []
            
            # Check if no players were found
            if "Players found: 0" in html_content or "No players found" in html_content:
                logger.info(f"No players found for search term: {search_term}")
                return []
            
            # Look for all table rows that contain player data
            rows = soup.find_all('tr')
            
            for row in rows:
                cells = row.find_all('td')
                if len(cells) >= 10:
                    
                    uscf_id_cell = cells[0].get_text(strip=True)
                    
                    # Validate that this looks like a USCF ID (7-8 digits)
                    if re.match(r'^\d{7,8}', uscf_id_cell):
                        
                        rating_cell = cells[1].get_text(strip=True)
                        quick_rating_cell = cells[2].get_text(strip=True)
                        state_cell = cells[7].get_text(strip=True)
                        exp_date_cell = cells[8].get_text(strip=True)
                        name_cell = cells[9].get_text(strip=True)
                        
                        # Parse the ratings
                        regular_rating = self._parse_rating(rating_cell)
                        quick_rating = self._parse_rating(quick_rating_cell)
                        
                        # Clean up the data
                        uscf_id = uscf_id_cell.strip()
                        raw_name = name_cell.strip()
                        formatted_name = self._format_name(raw_name)
                        state = state_cell.strip() if state_cell.strip() else None
                        exp_date = exp_date_cell.strip() if exp_date_cell.strip() else None
                        
                        player = USCFPlayer(
                            uscf_id=uscf_id,
                            name=formatted_name,
                            rating_regular=regular_rating,
                            rating_quick=quick_rating,
                            state=state,
                            expiration_date=exp_date
                        )
                        
                        players.append(player)
                        logger.info(f"Found player: {formatted_name} (ID: {uscf_id})")
            
            return players
            
        except Exception as e:
            logger.error(f"Failed to parse multiple players: {e}")
            return []
    
    def lookup_by_id(self, uscf_id: str) -> Optional[USCFPlayer]:
        """
        Look up a player by their USCF ID
        
        Args:
            uscf_id: The USCF ID number as a string
            
        Returns:
            USCFPlayer object if found, None if not found or error
        """
        # Validate USCF ID format (typically 7-8 digits)
        uscf_id = str(uscf_id).strip()
        if not re.match(r'^\d{7,8}$', uscf_id):
            logger.warning(f"Invalid USCF ID format: {uscf_id}")
            return None
        
        html_content = self._make_request(uscf_id)
        if html_content:
            return self._parse_player_data(html_content, uscf_id)
        return None
    
    def lookup_by_name(self, first_name: str, last_name: str) -> List[USCFPlayer]:
        """
        Look up players by name (may return multiple results)
        
        Args:
            first_name: Player's first name
            last_name: Player's last name
            
        Returns:
            List of USCFPlayer objects found
        """
        # Try different name formats that USCF might accept
        search_formats = []
        
        if last_name and first_name:
            search_formats.extend([
                f"{last_name}, {first_name}",
                f"{first_name} {last_name}",
                f"{last_name} {first_name}"
            ])
        elif last_name:
            search_formats.append(last_name)
        elif first_name:
            search_formats.append(first_name)
        
        for search_term in search_formats:
            logger.info(f"Trying name format: {search_term}")
            html_content = self._make_request(search_term)
            
            if html_content:
                players = self._parse_multiple_players(html_content, search_term)
                if players:
                    return players
        
        return []

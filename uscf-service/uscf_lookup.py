from __future__ import annotations
import time
from dataclasses import dataclass
from typing import List, Optional
import requests
from bs4 import BeautifulSoup, Tag

@dataclass
class USCFPlayer:
    uscf_id: str
    name: str
    rating_regular: Optional[int]
    rating_quick: Optional[int]
    state: Optional[str]
    expiration_date: Optional[str]

    def __post_init__(self):
        if isinstance(self.rating_regular, str) and not self.rating_regular.isdigit():
            self.rating_regular = None
        if isinstance(self.rating_quick, str) and not self.rating_quick.isdigit():
            self.rating_quick = None
        
        if self.rating_regular is not None:
            self.rating_regular = int(self.rating_regular)
        if self.rating_quick is not None:
            self.rating_quick = int(self.rating_quick)

class USCFLookup:
    def __init__(self, rate_limit_seconds: float = 1.0):
        self.base_url = "https://www.uschess.org/msa/MbrDtlMain.php?"
        self.search_url = "https://www.uschess.org/msa/MbrLst.php"
        self.last_request_time = 0
        self.rate_limit_seconds = rate_limit_seconds

    def _rate_limit(self):
        elapsed_time = time.time() - self.last_request_time
        if elapsed_time < self.rate_limit_seconds:
            time.sleep(self.rate_limit_seconds - elapsed_time)
        self.last_request_time = time.time()

    def lookup_by_id(self, uscf_id: str) -> Optional[USCFPlayer]:
        self._rate_limit()
        response = requests.get(f"{self.base_url}{uscf_id}")
        if response.status_code != 200:
            return None

        soup = BeautifulSoup(response.content, 'lxml')
        main_table = soup.find('table', {'cellpadding': '2', 'cellspacing': '0'})
        if not main_table:
            return None

        name_tag = main_table.find('font', {'face': 'Verdana, Arial, Helvetica, sans-serif, trebuchet ms', 'size': '5'})
        if not name_tag:
            return None

        name = ' '.join(name_tag.get_text(strip=True).split())
        
        rating_regular_tag = soup.find(lambda tag: 'Regular Rating' in tag.text and 'pre-rating' not in tag.text.lower())
        rating_regular = int(rating_regular_tag.find_next('td').text.split('/')[0].strip()) if rating_regular_tag else None

        rating_quick_tag = soup.find(lambda tag: 'Quick Rating' in tag.text)
        rating_quick = int(rating_quick_tag.find_next('td').text.split('/')[0].strip()) if rating_quick_tag else None

        state_tag = soup.find(lambda tag: 'State:' in tag.text)
        state = state_tag.find_next('td').text.strip() if state_tag else None

        expiration_date_tag = soup.find(lambda tag: 'Expires' in tag.text)
        expiration_date_text = expiration_date_tag.find_next('td').get_text(strip=True) if expiration_date_tag else None
        
        return USCFPlayer(
            uscf_id=uscf_id, name=name, rating_regular=rating_regular,
            rating_quick=rating_quick, state=state, expiration_date=expiration_date_text
        )

    def lookup_by_name(self, first_name: str, last_name: str) -> List[USCFPlayer]:
        self._rate_limit()
        payload = {'memfname': first_name, 'memlname': last_name, 'search': 'Search'}
        response = requests.post(self.search_url, data=payload)
        
        if response.status_code != 200:
            return []

        soup = BeautifulSoup(response.content, 'lxml')
        player_table = soup.find('table', {'cellpadding': '2', 'cellspacing': '0', 'width': '100%'})
        if not player_table:
            return []
        
        players = []
        rows = player_table.find_all('tr')[1:] # Skip header row
        for row in rows:
            cells = row.find_all('td')
            if len(cells) < 4: continue

            uscf_id = cells[0].text.strip()
            name = cells[1].text.strip()
            rating_text = cells[2].text.strip()
            state = cells[3].text.strip()
            expiration_date_text = cells[4].text.strip() if len(cells) > 4 else None

            rating_regular = int(rating_text.split('/')[0]) if '/' in rating_text else None
            
            players.append(USCFPlayer(
                uscf_id=uscf_id, name=name, rating_regular=rating_regular,
                rating_quick=None, state=state, expiration_date=expiration_date_text
            ))
            
        return players

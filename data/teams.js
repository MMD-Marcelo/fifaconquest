// Team data and league metadata. Keep gameplay code out of this file.
const ALL_TEAMS = [
  // Premier League
  "Arsenal","Aston Villa","Bournemouth","Brentford","Brighton & Hove Albion","Chelsea","Crystal Palace",
  "Everton","Fulham","Ipswich Town","Leicester City","Liverpool","Manchester City","Manchester United",
  "Newcastle United","Nottingham Forest","Southampton","Tottenham Hotspur","West Ham United","Wolverhampton Wanderers",
  // La Liga
  "Athletic Club","Atlético de Madrid","Barcelona","Celta de Vigo","Deportivo Alavés","Espanyol","Getafe",
  "Girona","Las Palmas","Leganés","Mallorca","Osasuna","Rayo Vallecano","Real Betis","Real Madrid",
  "Real Sociedad","Sevilla","Valencia","Valladolid","Villarreal",
  // Bundesliga
  "Augsburg","Bayer Leverkusen","Bayern München","Bochum","Borussia Dortmund","Borussia Mönchengladbach",
  "Eintracht Frankfurt","Freiburg","Heidenheim","Hoffenheim","Holstein Kiel","Mainz 05","RB Leipzig",
  "St. Pauli","Stuttgart","Union Berlin","Werder Bremen","Wolfsburg",
  // Serie A
  "Bergamo Calcio","Bologna","Cagliari","Como","Empoli","Fiorentina","Genoa","Juventus","Latium",
  "Lecce","Lombardia FC","Milano FC","Monza","Napoli","Parma","Roma","Torino","Udinese","Venezia","Verona",
  // Ligue 1
  "Angers","Auxerre","Brest","Havre AC","Lens","Lille","Lyon","Marseille","Monaco","Montpellier",
  "Nantes","Nice","Paris Saint-Germain","Reims","Rennes","Saint-Étienne","Strasbourg","Toulouse",
  // Liga Argentina
  "Argentinos Juniors","Atlético Tucumán","Banfield","Barracas Central","Belgrano","Boca Juniors",
  "Central Córdoba","Defensa y Justicia","Deportivo Riestra","Estudiantes","Gimnasia","Godoy Cruz",
  "Huracán","Independiente","Independiente Rivadavia","Instituto","Lanús","Newell's Old Boys",
  "Platense","Racing Club","River Plate","Rosario Central","San Lorenzo","Sarmiento","Talleres",
  "Tigre","Unión","Vélez Sarsfield",
  // Liga Portugal
  "Arouca","AVS","Benfica","Boavista","Braga","Casa Pia","Estoril Praia","Estrela da Amadora",
  "Famalicão","Farense","FC Porto","Gil Vicente","Moreirense","Nacional","Rio Ave","Santa Clara",
  "Sporting CP","Vitória SC",
  // Eredivisie
  "Ajax","Almere City","AZ Alkmaar","FC Groningen","FC Twente","FC Utrecht","Feyenoord","Fortuna Sittard",
  "Go Ahead Eagles","Heracles Almelo","NAC Breda","NEC Nijmegen","PEC Zwolle","PSV","RKC Waalwijk",
  "sc Heerenveen","Sparta Rotterdam","Willem II",
  // Saudi League
  "Al Ahli","Al Akhdoud","Al Ettifaq","Al Fateh","Al Fayha","Al Hilal","Al Ittihad","Al Khaleej",
  "Al Kholood","Al Nassr","Al Orobah","Al Qadsiah","Al Raed","Al Riyadh","Al Shabab","Al Taawoun",
  "Al Wehda","Damac",
  // MLS
  "Atlanta United","Austin FC","CF Montréal","Charlotte FC","Chicago Fire","Colorado Rapids",
  "Columbus Crew","D.C. United","FC Cincinnati","FC Dallas","Houston Dynamo","Inter Miami CF",
  "LA Galaxy","LAFC","Minnesota United","Nashville SC","New England Revolution","New York City FC",
  "New York Red Bulls","Orlando City","Philadelphia Union","Portland Timbers","Real Salt Lake",
  "San Diego FC","San Jose Earthquakes","Seattle Sounders","Sporting Kansas City","St. Louis City SC",
  "Toronto FC","Vancouver Whitecaps",
  // Süper Lig
  "Adana Demirspor","Alanyaspor","Antalyaspor","Beşiktaş","Bodrum FK","Eyüpspor","Fenerbahçe",
  "Galatasaray","Gaziantep FK","Göztepe","Hatayspor","İstanbul Başakşehir","Kasımpaşa","Kayserispor",
  "Konyaspor","Rizespor","Samsunspor","Sivasspor","Trabzonspor",
  // Belgian Pro League
  "Anderlecht","Antwerp","Beerschot","Cercle Brugge","Charleroi","Club Brugge","Dender EH","Genk",
  "Gent","Kortrijk","Mechelen","OH Leuven","Sint-Truiden","Standard Liège","Union SG","Westerlo",
  // Scottish Premiership
  "Aberdeen","Celtic","Dundee FC","Dundee United","Heart of Midlothian","Hibernian","Kilmarnock",
  "Motherwell","Rangers","Ross County","St. Johnstone","St. Mirren",
  // Danish Superliga
  "AaB","AGF","Brøndby IF","FC København","FC Midtjylland","FC Nordsjælland","Lyngby BK","Randers FC",
  "Silkeborg IF","SønderjyskE","Vejle Boldklub","Viborg FF",
  // Hungarian NB I
  "Ferencvárosi TC",
  // Polish Ekstraklasa
  "Cracovia","GKS Katowice","Górnik Zabrze","Jagiellonia Białystok","Korona Kielce","Lech Poznań",
  "Lechia Gdańsk","Legia Warszawa","Motor Lublin","Piast Gliwice","Pogoń Szczecin","Puszcza Niepołomice",
  "Radomiak Radom","Raków Częstochowa","Stal Mielec","Śląsk Wrocław","Widzew Łódź","Zagłębie Lubin",
  // Romanian Liga I
  "CFR Cluj","Dinamo București","Farul Constanța","FC Botoșani","FC Hermannstadt","FC Universitatea Cluj",
  "FCSB","Gloria Buzău","Oțelul Galați","Petrolul Ploiești","Politehnica Iași","Rapid București",
  "Sepsi OSK","Unirea Slobozia","Universitatea Craiova","UTA Arad",
  // Swedish Allsvenskan
  "AIK","BK Häcken","Djurgårdens IF","GAIS","Halmstads BK","Hammarby IF","IF Brommapojkarna",
  "IF Elfsborg","IFK Göteborg","IFK Norrköping","IFK Värnamo","IK Sirius","Kalmar FF","Malmö FF",
  "Mjällby AIF","Västerås SK",
  // Swiss Super League
  "BSC Young Boys","FC Basel","FC Lausanne-Sport","FC Lugano","FC Luzern","FC Sion","FC St. Gallen",
  "FC Winterthur","FC Zürich","Grasshopper Club","Servette FC","Yverdon Sport FC",
  // Norwegian Eliteserien
  "Bodø/Glimt","Brann","Fredrikstad","HamKam","Haugesund","KFUM Oslo","Kristiansund","Lillestrøm",
  "Molde","Odd","Rosenborg","Sandefjord","Sarpsborg 08","Strømsgodset","Tromsø","Viking"
];

const TEAM_LEAGUE = {
  // Premier League
  "Arsenal":"Premier League","Aston Villa":"Premier League","Bournemouth":"Premier League",
  "Brentford":"Premier League","Brighton & Hove Albion":"Premier League","Chelsea":"Premier League",
  "Crystal Palace":"Premier League","Everton":"Premier League","Fulham":"Premier League",
  "Ipswich Town":"Premier League","Leicester City":"Premier League","Liverpool":"Premier League",
  "Manchester City":"Premier League","Manchester United":"Premier League","Newcastle United":"Premier League",
  "Nottingham Forest":"Premier League","Southampton":"Premier League","Tottenham Hotspur":"Premier League",
  "West Ham United":"Premier League","Wolverhampton Wanderers":"Premier League",
  // La Liga
  "Athletic Club":"La Liga","Atlético de Madrid":"La Liga","Barcelona":"La Liga",
  "Celta de Vigo":"La Liga","Deportivo Alavés":"La Liga","Espanyol":"La Liga",
  "Getafe":"La Liga","Girona":"La Liga","Las Palmas":"La Liga","Leganés":"La Liga",
  "Mallorca":"La Liga","Osasuna":"La Liga","Rayo Vallecano":"La Liga","Real Betis":"La Liga",
  "Real Madrid":"La Liga","Real Sociedad":"La Liga","Sevilla":"La Liga","Valencia":"La Liga",
  "Valladolid":"La Liga","Villarreal":"La Liga",
  // Bundesliga
  "Augsburg":"Bundesliga","Bayer Leverkusen":"Bundesliga","Bayern München":"Bundesliga",
  "Bochum":"Bundesliga","Borussia Dortmund":"Bundesliga","Borussia Mönchengladbach":"Bundesliga",
  "Eintracht Frankfurt":"Bundesliga","Freiburg":"Bundesliga","Heidenheim":"Bundesliga",
  "Hoffenheim":"Bundesliga","Holstein Kiel":"Bundesliga","Mainz 05":"Bundesliga",
  "RB Leipzig":"Bundesliga","St. Pauli":"Bundesliga","Stuttgart":"Bundesliga",
  "Union Berlin":"Bundesliga","Werder Bremen":"Bundesliga","Wolfsburg":"Bundesliga",
  // Serie A
  "Bergamo Calcio":"Serie A","Bologna":"Serie A","Cagliari":"Serie A","Como":"Serie A",
  "Empoli":"Serie A","Fiorentina":"Serie A","Genoa":"Serie A","Juventus":"Serie A",
  "Latium":"Serie A","Lecce":"Serie A","Lombardia FC":"Serie A","Milano FC":"Serie A",
  "Monza":"Serie A","Napoli":"Serie A","Parma":"Serie A","Roma":"Serie A",
  "Torino":"Serie A","Udinese":"Serie A","Venezia":"Serie A","Verona":"Serie A",
  // Ligue 1
  "Angers":"Ligue 1","Auxerre":"Ligue 1","Brest":"Ligue 1","Havre AC":"Ligue 1",
  "Lens":"Ligue 1","Lille":"Ligue 1","Lyon":"Ligue 1","Marseille":"Ligue 1",
  "Monaco":"Ligue 1","Montpellier":"Ligue 1","Nantes":"Ligue 1","Nice":"Ligue 1",
  "Paris Saint-Germain":"Ligue 1","Reims":"Ligue 1","Rennes":"Ligue 1",
  "Saint-Étienne":"Ligue 1","Strasbourg":"Ligue 1","Toulouse":"Ligue 1",
  // Argentina
  "Argentinos Juniors":"Liga Argentina","Atlético Tucumán":"Liga Argentina","Banfield":"Liga Argentina",
  "Barracas Central":"Liga Argentina","Belgrano":"Liga Argentina","Boca Juniors":"Liga Argentina",
  "Central Córdoba":"Liga Argentina","Defensa y Justicia":"Liga Argentina","Deportivo Riestra":"Liga Argentina",
  "Estudiantes":"Liga Argentina","Gimnasia":"Liga Argentina","Godoy Cruz":"Liga Argentina",
  "Huracán":"Liga Argentina","Independiente":"Liga Argentina","Independiente Rivadavia":"Liga Argentina",
  "Instituto":"Liga Argentina","Lanús":"Liga Argentina","Newell's Old Boys":"Liga Argentina",
  "Platense":"Liga Argentina","Racing Club":"Liga Argentina","River Plate":"Liga Argentina",
  "Rosario Central":"Liga Argentina","San Lorenzo":"Liga Argentina","Sarmiento":"Liga Argentina",
  "Talleres":"Liga Argentina","Tigre":"Liga Argentina","Unión":"Liga Argentina","Vélez Sarsfield":"Liga Argentina",
  // Portugal
  "Arouca":"Liga Portugal","AVS":"Liga Portugal","Benfica":"Liga Portugal","Boavista":"Liga Portugal",
  "Braga":"Liga Portugal","Casa Pia":"Liga Portugal","Estoril Praia":"Liga Portugal",
  "Estrela da Amadora":"Liga Portugal","Famalicão":"Liga Portugal","Farense":"Liga Portugal",
  "FC Porto":"Liga Portugal","Gil Vicente":"Liga Portugal","Moreirense":"Liga Portugal",
  "Nacional":"Liga Portugal","Rio Ave":"Liga Portugal","Santa Clara":"Liga Portugal",
  "Sporting CP":"Liga Portugal","Vitória SC":"Liga Portugal",
  // Eredivisie
  "Ajax":"Eredivisie","Almere City":"Eredivisie","AZ Alkmaar":"Eredivisie","FC Groningen":"Eredivisie",
  "FC Twente":"Eredivisie","FC Utrecht":"Eredivisie","Feyenoord":"Eredivisie","Fortuna Sittard":"Eredivisie",
  "Go Ahead Eagles":"Eredivisie","Heracles Almelo":"Eredivisie","NAC Breda":"Eredivisie",
  "NEC Nijmegen":"Eredivisie","PEC Zwolle":"Eredivisie","PSV":"Eredivisie","RKC Waalwijk":"Eredivisie",
  "sc Heerenveen":"Eredivisie","Sparta Rotterdam":"Eredivisie","Willem II":"Eredivisie",
  // Saudi League
  "Al Ahli":"Saudi League","Al Akhdoud":"Saudi League","Al Ettifaq":"Saudi League","Al Fateh":"Saudi League",
  "Al Fayha":"Saudi League","Al Hilal":"Saudi League","Al Ittihad":"Saudi League","Al Khaleej":"Saudi League",
  "Al Kholood":"Saudi League","Al Nassr":"Saudi League","Al Orobah":"Saudi League","Al Qadsiah":"Saudi League",
  "Al Raed":"Saudi League","Al Riyadh":"Saudi League","Al Shabab":"Saudi League","Al Taawoun":"Saudi League",
  "Al Wehda":"Saudi League","Damac":"Saudi League",
  // MLS
  "Atlanta United":"MLS","Austin FC":"MLS","CF Montréal":"MLS","Charlotte FC":"MLS",
  "Chicago Fire":"MLS","Colorado Rapids":"MLS","Columbus Crew":"MLS","D.C. United":"MLS",
  "FC Cincinnati":"MLS","FC Dallas":"MLS","Houston Dynamo":"MLS","Inter Miami CF":"MLS",
  "LA Galaxy":"MLS","LAFC":"MLS","Minnesota United":"MLS","Nashville SC":"MLS",
  "New England Revolution":"MLS","New York City FC":"MLS","New York Red Bulls":"MLS",
  "Orlando City":"MLS","Philadelphia Union":"MLS","Portland Timbers":"MLS","Real Salt Lake":"MLS",
  "San Diego FC":"MLS","San Jose Earthquakes":"MLS","Seattle Sounders":"MLS",
  "Sporting Kansas City":"MLS","St. Louis City SC":"MLS","Toronto FC":"MLS","Vancouver Whitecaps":"MLS",
  // Süper Lig
  "Adana Demirspor":"Süper Lig","Alanyaspor":"Süper Lig","Antalyaspor":"Süper Lig",
  "Beşiktaş":"Süper Lig","Bodrum FK":"Süper Lig","Eyüpspor":"Süper Lig","Fenerbahçe":"Süper Lig",
  "Galatasaray":"Süper Lig","Gaziantep FK":"Süper Lig","Göztepe":"Süper Lig","Hatayspor":"Süper Lig",
  "İstanbul Başakşehir":"Süper Lig","Kasımpaşa":"Süper Lig","Kayserispor":"Süper Lig",
  "Konyaspor":"Süper Lig","Rizespor":"Süper Lig","Samsunspor":"Süper Lig","Sivasspor":"Süper Lig",
  "Trabzonspor":"Süper Lig",
  // Belgian
  "Anderlecht":"Pro League","Antwerp":"Pro League","Beerschot":"Pro League","Cercle Brugge":"Pro League",
  "Charleroi":"Pro League","Club Brugge":"Pro League","Dender EH":"Pro League","Genk":"Pro League",
  "Gent":"Pro League","Kortrijk":"Pro League","Mechelen":"Pro League","OH Leuven":"Pro League",
  "Sint-Truiden":"Pro League","Standard Liège":"Pro League","Union SG":"Pro League","Westerlo":"Pro League",
  // Scottish
  "Aberdeen":"Scottish Prem.","Celtic":"Scottish Prem.","Dundee FC":"Scottish Prem.",
  "Dundee United":"Scottish Prem.","Heart of Midlothian":"Scottish Prem.","Hibernian":"Scottish Prem.",
  "Kilmarnock":"Scottish Prem.","Motherwell":"Scottish Prem.","Rangers":"Scottish Prem.",
  "Ross County":"Scottish Prem.","St. Johnstone":"Scottish Prem.","St. Mirren":"Scottish Prem.",
  // Danish
  "AaB":"Danish Superliga","AGF":"Danish Superliga","Brøndby IF":"Danish Superliga",
  "FC København":"Danish Superliga","FC Midtjylland":"Danish Superliga","FC Nordsjælland":"Danish Superliga",
  "Lyngby BK":"Danish Superliga","Randers FC":"Danish Superliga","Silkeborg IF":"Danish Superliga",
  "SønderjyskE":"Danish Superliga","Vejle Boldklub":"Danish Superliga","Viborg FF":"Danish Superliga",
  // Hungarian
  "Ferencvárosi TC":"Hungarian NB I",
  // Polish
  "Cracovia":"Polish Ekstraklasa","GKS Katowice":"Polish Ekstraklasa","Górnik Zabrze":"Polish Ekstraklasa",
  "Jagiellonia Białystok":"Polish Ekstraklasa","Korona Kielce":"Polish Ekstraklasa","Lech Poznań":"Polish Ekstraklasa",
  "Lechia Gdańsk":"Polish Ekstraklasa","Legia Warszawa":"Polish Ekstraklasa","Motor Lublin":"Polish Ekstraklasa",
  "Piast Gliwice":"Polish Ekstraklasa","Pogoń Szczecin":"Polish Ekstraklasa","Puszcza Niepołomice":"Polish Ekstraklasa",
  "Radomiak Radom":"Polish Ekstraklasa","Raków Częstochowa":"Polish Ekstraklasa","Stal Mielec":"Polish Ekstraklasa",
  "Śląsk Wrocław":"Polish Ekstraklasa","Widzew Łódź":"Polish Ekstraklasa","Zagłębie Lubin":"Polish Ekstraklasa",
  // Romanian
  "CFR Cluj":"Romanian Liga I","Dinamo București":"Romanian Liga I","Farul Constanța":"Romanian Liga I",
  "FC Botoșani":"Romanian Liga I","FC Hermannstadt":"Romanian Liga I","FC Universitatea Cluj":"Romanian Liga I",
  "FCSB":"Romanian Liga I","Gloria Buzău":"Romanian Liga I","Oțelul Galați":"Romanian Liga I",
  "Petrolul Ploiești":"Romanian Liga I","Politehnica Iași":"Romanian Liga I","Rapid București":"Romanian Liga I",
  "Sepsi OSK":"Romanian Liga I","Unirea Slobozia":"Romanian Liga I","Universitatea Craiova":"Romanian Liga I",
  "UTA Arad":"Romanian Liga I",
  // Swedish
  "AIK":"Swedish Allsvenskan","BK Häcken":"Swedish Allsvenskan","Djurgårdens IF":"Swedish Allsvenskan",
  "GAIS":"Swedish Allsvenskan","Halmstads BK":"Swedish Allsvenskan","Hammarby IF":"Swedish Allsvenskan",
  "IF Brommapojkarna":"Swedish Allsvenskan","IF Elfsborg":"Swedish Allsvenskan","IFK Göteborg":"Swedish Allsvenskan",
  "IFK Norrköping":"Swedish Allsvenskan","IFK Värnamo":"Swedish Allsvenskan","IK Sirius":"Swedish Allsvenskan",
  "Kalmar FF":"Swedish Allsvenskan","Malmö FF":"Swedish Allsvenskan","Mjällby AIF":"Swedish Allsvenskan",
  "Västerås SK":"Swedish Allsvenskan",
  // Swiss
  "BSC Young Boys":"Swiss Super League","FC Basel":"Swiss Super League","FC Lausanne-Sport":"Swiss Super League",
  "FC Lugano":"Swiss Super League","FC Luzern":"Swiss Super League","FC Sion":"Swiss Super League",
  "FC St. Gallen":"Swiss Super League","FC Winterthur":"Swiss Super League","FC Zürich":"Swiss Super League",
  "Grasshopper Club":"Swiss Super League","Servette FC":"Swiss Super League","Yverdon Sport FC":"Swiss Super League",
  // Norwegian
  "Bodø/Glimt":"Norwegian Eliteserien","Brann":"Norwegian Eliteserien","Fredrikstad":"Norwegian Eliteserien",
  "HamKam":"Norwegian Eliteserien","Haugesund":"Norwegian Eliteserien","KFUM Oslo":"Norwegian Eliteserien",
  "Kristiansund":"Norwegian Eliteserien","Lillestrøm":"Norwegian Eliteserien","Molde":"Norwegian Eliteserien",
  "Odd":"Norwegian Eliteserien","Rosenborg":"Norwegian Eliteserien","Sandefjord":"Norwegian Eliteserien",
  "Sarpsborg 08":"Norwegian Eliteserien","Strømsgodset":"Norwegian Eliteserien","Tromsø":"Norwegian Eliteserien",
  "Viking":"Norwegian Eliteserien"
};

import type { ScenarioDefinition } from '../types/game';

// Historical background, characters and "original timeline" entries describe DOCUMENTED history
// (summarised from standard references). Decisions and their consequences are ALTERNATIVE
// history and are always labelled as such in the UI.
export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'timur-east',
    title: "Timur's Eastern Campaign",
    subtitle: 'Otrar, February 1405',
    question: 'What if Timur had survived and continued his eastern campaign against Ming China?',
    mapKey: '1400', start: { y: 1405, m: 0 }, era: 'medieval', artHue: 205,
    background: [
      'By 1404 Timur (Tamerlane) had built an empire from Anatolia to the borders of India. In 1402 he crushed the Ottomans at Ankara and captured Sultan Bayezid I, plunging the Ottoman state into a decade-long civil war (the Interregnum).',
      'Returning to Samarkand, Timur assembled a large army for a winter campaign against the Ming dynasty, whose Yongle Emperor had usurped the throne in 1402 and had treated Timurid envoys as tributaries.',
      'The army marched north-east in the bitter winter of 1404–05. At Otrar, on the Syr Darya, Timur fell ill and died on 18 February 1405, aged about 68. The campaign was abandoned and his succession dissolved into conflict among his sons and grandsons.',
    ],
    sourcesNote: 'Background follows standard accounts (e.g. B. F. Manz, "The Rise and Rule of Tamerlane", 1989). Borders: historical-basemaps c.1400 with editorial corrections for China.',
    sensitivity: "Timur's campaigns caused enormous loss of life (e.g. Delhi 1398, Isfahan 1387, Baghdad 1401). The simulation models political and economic consequences; it does not celebrate conquest.",
    focusCountries: ['Timurid Empire', 'Ming Empire', 'Ottoman Empire', 'Northern Yuan', 'Mamluke Sultanate', 'Byzantine Empire'],
    recommended: 'Timurid Empire',
    characters: [
      { name: 'Timur (Tamerlane)', role: 'Emir of the Timurid Empire', years: 'c.1336–1405', bio: 'Turco-Mongol conqueror; never took the title of khan, ruling through Chinggisid puppet khans.', country: 'Timurid Empire' },
      { name: 'Shah Rukh', role: "Timur's youngest son", years: '1377–1447', bio: 'Governor of Khorasan; historically emerged victorious from the succession struggle by 1409.', country: 'Timurid Empire' },
      { name: 'Pir Muhammad', role: "Timur's designated heir (grandson)", years: '1374–1407', bio: 'Named successor on Timur\'s deathbed; assassinated in 1407.', country: 'Timurid Empire' },
      { name: 'Yongle Emperor (Zhu Di)', role: 'Emperor of Ming China', years: '1360–1424', bio: 'Usurped the throne in 1402; sponsored Zheng He\'s voyages and campaigns against the Mongols.', country: 'Ming Empire' },
      { name: 'Mehmed Çelebi', role: 'Ottoman prince', years: 'c.1389–1421', bio: 'Won the Ottoman Interregnum in 1413 and reunited the state as Mehmed I.', country: 'Ottoman Empire' },
    ],
    originalTimeline: [
      { date: { y: 1402, m: 6 }, title: 'Battle of Ankara', text: 'Timur defeats and captures Ottoman Sultan Bayezid I.', countries: ['Timurid Empire', 'Ottoman Empire'] },
      { date: { y: 1404, m: 11 }, title: 'March on China begins', text: 'Timur leaves Samarkand with a large army heading for Ming China.', countries: ['Timurid Empire'] },
      { date: { y: 1405, m: 1 }, title: 'Death of Timur at Otrar', text: 'Timur dies of illness; the campaign is abandoned.', countries: ['Timurid Empire'] },
      { date: { y: 1405, m: 6 }, title: 'Zheng He\'s first voyage', text: 'The Ming treasure fleet sails for the Indian Ocean.', countries: ['Ming Empire'] },
      { date: { y: 1409, m: 4 }, title: 'Shah Rukh secures Samarkand', text: 'After four years of succession war Shah Rukh controls the Timurid core.', countries: ['Timurid Empire'] },
      { date: { y: 1413, m: 6 }, title: 'End of the Ottoman Interregnum', text: 'Mehmed I reunites the Ottoman state.', countries: ['Ottoman Empire'] },
      { date: { y: 1421, m: 1 }, title: 'Beijing becomes Ming capital', text: 'The Yongle Emperor moves the capital north to Beijing.', countries: ['Ming Empire'] },
    ],
    decisions: [
      { id: 'timur_fate', question: 'Does Timur survive the winter at Otrar?', context: 'Historically he died on 18 February 1405.', options: [
        { id: 'dies', label: 'Timur dies at Otrar', description: 'Documented history: the succession crisis begins immediately.', historical: true },
        { id: 'survives', label: 'Timur recovers', description: 'Timur lives (with failing health) and can continue the campaign.' },
      ] },
      { id: 'campaign', question: 'What does the surviving Timur do next?', context: 'Only relevant if Timur survives.', dependsOn: { decision: 'timur_fate', option: 'survives' }, options: [
        { id: 'invade', label: 'Press on into Ming China', description: 'War with the Ming. Outcome depends on supply across the Tarim/Gobi routes, Ming defences and Timurid cohesion.' },
        { id: 'consolidate', label: 'Return and settle the succession', description: 'Timur names a single heir and spends his last years consolidating the empire.' },
      ] },
      { id: 'ottomans', question: 'How do the Ottomans emerge from the Interregnum?', context: 'Historically Mehmed I won in 1413.', options: [
        { id: 'historical', label: 'Civil war continues (historical)', description: 'The Ottomans remain weakened by internal strife for years.', historical: true },
        { id: 'quick', label: 'Rapid reunification', description: 'One prince quickly reunifies the state, restoring stability.' },
      ] },
    ],
    consequences: [
      { decision: 'timur_fate', option: 'dies', text: 'Succession crisis fires; Timurid stability and legitimacy fall sharply; rival claimants may break away.' },
      { decision: 'timur_fate', option: 'survives', text: 'Timur stays in power with low health; legitimacy remains high while he lives, but every month carries mortality risk.' },
      { decision: 'campaign', option: 'invade', text: 'A war against the Ming begins. Logistics over long desert routes heavily penalise Timurid supply.' },
      { decision: 'campaign', option: 'consolidate', text: 'A designated heir gains legitimacy, reducing the chance of fragmentation when Timur dies.' },
      { decision: 'ottomans', option: 'quick', text: 'Ottoman stability is restored — Byzantium faces renewed pressure much sooner.' },
    ],
  },
  {
    id: 'waterloo',
    title: 'The Hundred Days',
    subtitle: 'Belgium, June 1815',
    question: 'What if Napoleon had won at Waterloo?',
    mapKey: '1815', start: { y: 1815, m: 5 }, era: 'industrial', artHue: 220,
    background: [
      'In March 1815 Napoleon escaped exile on Elba and retook power in France. The Congress of Vienna powers declared him an outlaw and formed the Seventh Coalition.',
      'Napoleon struck first, invading present-day Belgium to defeat Wellington\'s Anglo-allied army and Blücher\'s Prussians before Austrian and Russian armies could arrive.',
      'On 18 June 1815, at Waterloo, Wellington held long enough for Prussian forces to arrive on the French flank. The French army broke; Napoleon abdicated on 22 June and was exiled to Saint Helena.',
    ],
    sourcesNote: 'Background follows standard accounts (e.g. A. Roberts, "Napoleon the Great", 2014). Borders: historical-basemaps 1815.',
    focusCountries: ['France', 'United Kingdom of Great Britain and Ireland', 'Prussia', 'Austrian Empire', 'Russian Empire', 'Spain'],
    recommended: 'France',
    characters: [
      { name: 'Napoleon Bonaparte', role: 'Emperor of the French', years: '1769–1821', bio: 'Returned from Elba for the Hundred Days.', country: 'France' },
      { name: 'Arthur Wellesley, Duke of Wellington', role: 'Anglo-allied commander', years: '1769–1852', bio: 'Commanded the Anglo-Dutch-German army at Waterloo.', country: 'United Kingdom of Great Britain and Ireland' },
      { name: 'Gebhard von Blücher', role: 'Prussian field marshal', years: '1742–1819', bio: 'His army\'s arrival decided the battle.', country: 'Prussia' },
      { name: 'Klemens von Metternich', role: 'Austrian foreign minister', years: '1773–1859', bio: 'Architect of the post-Napoleonic order.', country: 'Austrian Empire' },
      { name: 'Alexander I', role: 'Emperor of Russia', years: '1777–1825', bio: 'Leading force of the coalition; promoter of the Holy Alliance.', country: 'Russian Empire' },
    ],
    originalTimeline: [
      { date: { y: 1815, m: 2 }, title: 'Napoleon returns from Elba', text: 'Napoleon lands in France and reaches Paris on 20 March.', countries: ['France'] },
      { date: { y: 1815, m: 5 }, title: 'Battle of Waterloo', text: 'French defeat by Wellington and Blücher (18 June).', countries: ['France', 'United Kingdom of Great Britain and Ireland', 'Prussia'] },
      { date: { y: 1815, m: 5 }, title: 'Second abdication', text: 'Napoleon abdicates on 22 June and is exiled to Saint Helena.', countries: ['France'] },
      { date: { y: 1815, m: 8 }, title: 'Holy Alliance', text: 'Russia, Austria and Prussia form a conservative alliance.', countries: ['Russian Empire', 'Austrian Empire', 'Prussia'] },
      { date: { y: 1815, m: 10 }, title: 'Second Treaty of Paris', text: 'France reduced to 1790 borders and occupied.', countries: ['France'] },
      { date: { y: 1830, m: 6 }, title: 'July Revolution', text: 'The Bourbon Restoration falls in France.', countries: ['France'] },
    ],
    decisions: [
      { id: 'battle', question: 'What happens at Waterloo?', context: '18 June 1815.', options: [
        { id: 'defeat', label: 'French defeat (historical)', description: 'Napoleon abdicates; the Bourbons return.', historical: true },
        { id: 'victory', label: 'Decisive French victory', description: 'Wellington is beaten before Blücher arrives. The Coalition armies remain in the field.' },
        { id: 'stalemate', label: 'Indecisive battle', description: 'Both sides withdraw; the war drags on.' },
      ] },
      { id: 'coalition', question: 'How does the Coalition react to a French success?', context: 'Applies if France is not defeated.', dependsOn: { decision: 'battle', option: 'victory' }, options: [
        { id: 'fight', label: 'Coalition fights on', description: 'Austria and Russia continue to mobilise.' },
        { id: 'negotiate', label: 'Britain seeks a negotiated peace', description: 'War-weary Britain leaves the coalition, isolating Prussia.' },
      ] },
    ],
    consequences: [
      { decision: 'battle', option: 'defeat', text: 'France becomes a constitutional monarchy, loses stability and pays reparations.' },
      { decision: 'battle', option: 'victory', text: 'France gains legitimacy and morale; Britain and Prussia lose manpower; the war continues dynamically.' },
      { decision: 'battle', option: 'stalemate', text: 'War exhaustion rises on all sides; the war continues.' },
      { decision: 'coalition', option: 'negotiate', text: 'Britain signs white peace with France; Prussia and Austria fight on alone.' },
    ],
  },
  {
    id: 'rome-endures',
    title: 'The Eternal Empire',
    subtitle: 'The Roman world, AD 400',
    question: 'What if the Roman Empire had never collapsed?',
    mapKey: '400', start: { y: 400, m: 0 }, era: 'classical', artHue: 8,
    background: [
      'At Theodosius I\'s death in 395 the Roman Empire was divided permanently between his sons: Arcadius in the East, Honorius in the West.',
      'The West faced Gothic federates, a Rhine frontier under pressure from Vandals, Alans and Suebi (who crossed in 406), fiscal exhaustion and civil wars between generals.',
      'Rome was sacked by the Visigoths in 410; the last Western emperor, Romulus Augustulus, was deposed in 476. The Eastern Empire endured for another thousand years.',
    ],
    sourcesNote: 'Background follows standard accounts (e.g. P. Heather, "The Fall of the Roman Empire", 2005). Borders: historical-basemaps AD 400.',
    focusCountries: ['Western Roman Empire', 'Eastern Roman Empire', 'Hunnic Empire', 'Visigoths', 'Persia', 'Franks'],
    recommended: 'Western Roman Empire',
    characters: [
      { name: 'Honorius', role: 'Western Roman Emperor', years: '384–423', bio: 'Ruled from Milan and later Ravenna.', country: 'Western Roman Empire' },
      { name: 'Stilicho', role: 'Magister militum of the West', years: 'c.359–408', bio: 'Half-Vandal general who defended the West; executed in 408.', country: 'Western Roman Empire' },
      { name: 'Arcadius', role: 'Eastern Roman Emperor', years: '377–408', bio: 'Ruled from Constantinople.', country: 'Eastern Roman Empire' },
      { name: 'Alaric I', role: 'King of the Visigoths', years: 'c.370–410', bio: 'Sacked Rome in 410.', country: 'Visigoths' },
      { name: 'Yazdegerd I', role: 'Sasanian King of Kings', years: 'r.399–420', bio: 'Kept peace with Rome.', country: 'Persia' },
    ],
    originalTimeline: [
      { date: { y: 406, m: 11 }, title: 'Rhine crossing', text: 'Vandals, Alans and Suebi cross the frozen Rhine into Gaul.', countries: ['Western Roman Empire'] },
      { date: { y: 408, m: 7 }, title: 'Execution of Stilicho', text: 'The West loses its most capable general.', countries: ['Western Roman Empire'] },
      { date: { y: 410, m: 7 }, title: 'Sack of Rome', text: 'Alaric\'s Visigoths sack the city of Rome.', countries: ['Western Roman Empire', 'Visigoths'] },
      { date: { y: 451, m: 5 }, title: 'Battle of the Catalaunian Plains', text: 'Romans and Visigoths halt Attila.', countries: ['Western Roman Empire', 'Hunnic Empire'] },
      { date: { y: 476, m: 8 }, title: 'Deposition of Romulus Augustulus', text: 'Conventional end of the Western Empire.', countries: ['Western Roman Empire'] },
    ],
    decisions: [
      { id: 'stilicho', question: 'Is Stilicho executed in 408?', context: 'His death removed the West\'s best defender.', options: [
        { id: 'executed', label: 'Stilicho executed (historical)', description: 'Court intrigue destroys the West\'s military leadership.', historical: true },
        { id: 'spared', label: 'Stilicho survives and reforms the army', description: 'The Western army is rebuilt with stronger discipline.' },
      ] },
      { id: 'reunify', question: 'Do East and West cooperate?', context: 'The two courts were often rivals.', options: [
        { id: 'rivals', label: 'Rival courts (historical)', description: 'Limited cooperation.', historical: true },
        { id: 'alliance', label: 'Permanent alliance', description: 'Constantinople subsidises and defends the West.' },
      ] },
      { id: 'fiscal', question: 'Does the West reform its finances?', context: 'Tax collapse undermined the army.', options: [
        { id: 'none', label: 'No reform (historical)', description: 'Fiscal decline continues.', historical: true },
        { id: 'reform', label: 'Tax and land reform', description: 'Higher tax efficiency, lower inflation.' },
      ] },
    ],
    consequences: [
      { decision: 'stilicho', option: 'spared', text: 'Western Roman military quality and morale rise; Visigoth relations improve.' },
      { decision: 'reunify', option: 'alliance', text: 'East and West sign an alliance and mutual guarantee.' },
      { decision: 'fiscal', option: 'reform', text: 'Western tax efficiency +15% (permanent modifier), inflation reduced.' },
    ],
  },
  {
    id: 'mongol-unity',
    title: 'One Ulus',
    subtitle: 'The Mongol world, 1279',
    question: 'What if the Mongol Empire had remained united?',
    mapKey: '1279', start: { y: 1279, m: 2 }, era: 'medieval', artHue: 38,
    background: [
      'After Great Khan Möngke died in 1259, a succession war between Kublai and Ariq Böke broke the unity of the Mongol Empire. By the 1260s it had split into four khanates: the Yuan, the Golden Horde, the Ilkhanate and the Chagatai Khanate.',
      'In 1279 Kublai\'s Yuan dynasty completed the conquest of Song China. The western khanates fought each other — notably the Golden Horde against the Ilkhanate over the Caucasus.',
    ],
    sourcesNote: 'Background follows standard accounts (e.g. T. May, "The Mongol Empire", 2018). Borders: historical-basemaps 1279 (Yuan label corrected).',
    sensitivity: 'The Mongol conquests caused catastrophic loss of life and destruction across Eurasia; this scenario explores counterfactual political structures, not glorification of conquest.',
    focusCountries: ['Yuan Dynasty', 'Khanate of the Golden Horde', 'Ilkhanate', 'Chagatai Khanate', 'Mamluke Sultanate', 'Byzantine Empire'],
    recommended: 'Yuan Dynasty',
    characters: [
      { name: 'Kublai Khan', role: 'Great Khan, Emperor of Yuan', years: '1215–1294', bio: 'Founded the Yuan dynasty and conquered the Song.', country: 'Yuan Dynasty' },
      { name: 'Abaqa Khan', role: 'Ilkhan', years: '1234–1282', bio: 'Ruled Persia; allied with Kublai against the Golden Horde.', country: 'Ilkhanate' },
      { name: 'Möngke-Temür', role: 'Khan of the Golden Horde', years: 'r.1266–1280', bio: 'Ruled the western steppe.', country: 'Khanate of the Golden Horde' },
      { name: 'Qaidu', role: 'Ruler in Central Asia', years: 'c.1230–1301', bio: 'Long-time rival of Kublai.', country: 'Chagatai Khanate' },
      { name: 'Qalawun', role: 'Mamluk Sultan', years: 'r.1279–1290', bio: 'Defeated the Ilkhanate at Homs in 1281.', country: 'Mamluke Sultanate' },
    ],
    originalTimeline: [
      { date: { y: 1260, m: 8 }, title: 'Ain Jalut', text: 'The Mamluks defeat the Mongols in Palestine.', countries: ['Mamluke Sultanate'] },
      { date: { y: 1279, m: 2 }, title: 'Battle of Yamen', text: 'The last Song resistance is destroyed.', countries: ['Yuan Dynasty'] },
      { date: { y: 1281, m: 9 }, title: 'Second Battle of Homs', text: 'The Mamluks defeat the Ilkhanate.', countries: ['Ilkhanate', 'Mamluke Sultanate'] },
      { date: { y: 1281, m: 7 }, title: 'Second invasion of Japan fails', text: 'The Yuan fleet is destroyed by a typhoon.', countries: ['Yuan Dynasty'] },
      { date: { y: 1294, m: 1 }, title: 'Death of Kublai', text: 'Kublai dies; the khanates drift further apart.', countries: ['Yuan Dynasty'] },
    ],
    decisions: [
      { id: 'unity', question: 'Do the khanates accept a single Great Khan?', context: 'Historically the empire had fractured by the 1260s.', options: [
        { id: 'divided', label: 'Four khanates (historical)', description: 'The khanates act independently.', historical: true },
        { id: 'federation', label: 'Federation under Kublai', description: 'The khanates become autonomous vassals of the Great Khan.' },
        { id: 'unified', label: 'Fully unified empire', description: 'All four khanates merge into a single state — vast but hard to govern.' },
      ] },
    ],
    consequences: [
      { decision: 'unity', option: 'federation', text: 'Golden Horde, Ilkhanate and Chagatai become vassals of the Yuan with good relations.' },
      { decision: 'unity', option: 'unified', text: 'All four khanates merge into one country with high overextension unrest.' },
    ],
  },
  {
    id: 'different-peace-1945',
    title: 'A Different Peace',
    subtitle: 'The world after 1945',
    question: 'What if the Second World War had ended differently — with a cooperative post-war order instead of the Cold War?',
    mapKey: '1945', start: { y: 1945, m: 8 }, era: 'modern', artHue: 220,
    background: [
      'The Second World War ended in Europe on 8 May 1945 and in Asia with Japan\'s surrender announced on 15 August 1945, after the atomic bombings of Hiroshima and Nagasaki and the Soviet declaration of war.',
      'The war killed an estimated 70–85 million people, including six million Jews murdered in the Holocaust by Nazi Germany and its collaborators, and millions of other victims of genocide, occupation and war crimes.',
      'Wartime cooperation between the United States, the Soviet Union and the United Kingdom quickly broke down. Germany and Korea were divided, and the Cold War shaped the next four decades.',
    ],
    sourcesNote: 'Background follows standard accounts (e.g. T. Judt, "Postwar", 2005; United States Holocaust Memorial Museum). Borders: historical-basemaps 1945, including occupation zones.',
    sensitivity: 'This scenario starts after the defeat of Nazi Germany and Imperial Japan. The Holocaust and wartime atrocities are documented facts and are never altered or minimised. Authoritarian regimes are modelled with explicit legitimacy and unrest costs.',
    focusCountries: ['United States', 'USSR', 'United Kingdom', 'France', 'China', 'Poland'],
    recommended: 'United States',
    characters: [
      { name: 'Harry S. Truman', role: 'President of the United States', years: '1884–1972', bio: 'President from April 1945.', country: 'United States' },
      { name: 'Joseph Stalin', role: 'Leader of the USSR', years: '1878–1953', bio: 'Dictator responsible for mass repression, deportations and the Gulag system.', country: 'USSR' },
      { name: 'Clement Attlee', role: 'Prime Minister of the UK', years: '1883–1967', bio: 'Elected July 1945; built the welfare state.', country: 'United Kingdom' },
      { name: 'Charles de Gaulle', role: 'Head of the French Provisional Government', years: '1890–1970', bio: 'Led Free France.', country: 'France' },
    ],
    originalTimeline: [
      { date: { y: 1945, m: 4 }, title: 'Victory in Europe', text: 'Germany surrenders unconditionally (8 May).', countries: [] },
      { date: { y: 1945, m: 7 }, title: 'Japan surrenders', text: 'Surrender announced 15 August; signed 2 September.', countries: [] },
      { date: { y: 1945, m: 9 }, title: 'United Nations founded', text: 'The UN Charter enters into force (24 October).', countries: [] },
      { date: { y: 1947, m: 5 }, title: 'Marshall Plan announced', text: 'US aid to rebuild Europe; the USSR refuses participation.', countries: ['United States', 'USSR'] },
      { date: { y: 1948, m: 5 }, title: 'Berlin Blockade', text: 'The USSR blockades West Berlin; Allied airlift follows.', countries: ['USSR', 'United States'] },
      { date: { y: 1949, m: 3 }, title: 'NATO founded', text: 'Western military alliance formed.', countries: ['United States', 'United Kingdom', 'France'] },
      { date: { y: 1950, m: 5 }, title: 'Korean War begins', text: 'North Korea invades the South.', countries: [] },
    ],
    decisions: [
      { id: 'order', question: 'What post-war order emerges?', context: 'Historically the Grand Alliance fractured into the Cold War.', options: [
        { id: 'coldwar', label: 'Cold War (historical)', description: 'Rival blocs, low trust between the US and USSR.', historical: true },
        { id: 'concert', label: 'Great-power concert', description: 'The Allies keep cooperating through the UN; trade agreements and non-aggression pacts.' },
      ] },
      { id: 'aid', question: 'How is reconstruction funded?', context: 'The Marshall Plan was offered to all of Europe but rejected by the Soviet bloc.', options: [
        { id: 'west', label: 'Western Europe only (historical)', description: 'Aid strengthens the Western bloc.', historical: true },
        { id: 'all', label: 'Pan-European reconstruction', description: 'Aid reaches all of Europe including the Soviet zone.' },
      ] },
    ],
    consequences: [
      { decision: 'order', option: 'coldwar', text: 'US–USSR opinion starts strongly negative; arms spending is high.' },
      { decision: 'order', option: 'concert', text: 'US, USSR, UK and France sign trade agreements and non-aggression pacts; trust rises.' },
      { decision: 'aid', option: 'all', text: 'All European countries gain treasury and stability; US relations improve across Europe.' },
    ],
  },
  {
    id: 'byzantium-rises',
    title: 'The Second Dawn of Byzantium',
    subtitle: 'Constantinople, 1402',
    question: 'What if the Byzantine Empire had survived — exploiting the Ottoman collapse after Ankara?',
    mapKey: '1400', start: { y: 1402, m: 7 }, era: 'medieval', artHue: 280,
    background: [
      'By 1400 the Byzantine Empire was reduced to Constantinople, parts of the Peloponnese and a few islands, and paid tribute to the Ottomans. Sultan Bayezid I had been besieging the city.',
      'Timur\'s victory at Ankara in July 1402 shattered Ottoman power and triggered a civil war among Bayezid\'s sons. Byzantium briefly regained Thessaloniki through the Treaty of Gallipoli (1403).',
      'The window closed: the Ottomans reunified in 1413 and Mehmed II conquered Constantinople on 29 May 1453.',
    ],
    sourcesNote: 'Background follows standard accounts (e.g. D. Nicol, "The Last Centuries of Byzantium", 1993). Borders: historical-basemaps c.1400.',
    focusCountries: ['Byzantine Empire', 'Ottoman Empire', 'Kingdom of Hungary', 'Timurid Empire', 'Trebizond', 'Mamluke Sultanate'],
    recommended: 'Byzantine Empire',
    characters: [
      { name: 'Manuel II Palaiologos', role: 'Byzantine Emperor', years: '1350–1425', bio: 'Toured Western Europe seeking aid.', country: 'Byzantine Empire' },
      { name: 'Süleyman Çelebi', role: 'Ottoman prince in Rumelia', years: 'c.1377–1411', bio: 'Signed the Treaty of Gallipoli (1403).', country: 'Ottoman Empire' },
      { name: 'Sigismund of Luxembourg', role: 'King of Hungary', years: '1368–1437', bio: 'Led the failed crusade of Nicopolis (1396).', country: 'Kingdom of Hungary' },
    ],
    originalTimeline: [
      { date: { y: 1402, m: 6 }, title: 'Battle of Ankara', text: 'Ottoman defeat by Timur; Bayezid captured.', countries: ['Ottoman Empire', 'Timurid Empire'] },
      { date: { y: 1403, m: 1 }, title: 'Treaty of Gallipoli', text: 'Thessaloniki and coastal lands returned to Byzantium.', countries: ['Byzantine Empire', 'Ottoman Empire'] },
      { date: { y: 1413, m: 6 }, title: 'Ottoman reunification', text: 'Mehmed I ends the Interregnum.', countries: ['Ottoman Empire'] },
      { date: { y: 1430, m: 2 }, title: 'Fall of Thessaloniki', text: 'The Ottomans take Thessaloniki from Venice.', countries: ['Ottoman Empire'] },
      { date: { y: 1453, m: 4 }, title: 'Fall of Constantinople', text: 'Mehmed II captures the city; the last emperor dies defending it.', countries: ['Byzantine Empire', 'Ottoman Empire'] },
    ],
    decisions: [
      { id: 'gallipoli', question: 'How much does Byzantium recover in 1403?', context: 'Historically: Thessaloniki and a coastal strip.', options: [
        { id: 'historical', label: 'Treaty of Gallipoli terms (historical)', description: 'Modest recovery.', historical: true },
        { id: 'offensive', label: 'Aggressive reconquest', description: 'Byzantium declares war on the divided Ottomans to reclaim Thrace.' },
      ] },
      { id: 'union', question: 'Does Byzantium secure Western help?', context: 'Church union was deeply divisive.', options: [
        { id: 'none', label: 'Little Western aid (historical)', description: 'Byzantium fights largely alone.', historical: true },
        { id: 'alliance', label: 'Alliance with Hungary', description: 'A Hungarian–Byzantine alliance against the Ottomans.' },
      ] },
    ],
    consequences: [
      { decision: 'gallipoli', option: 'offensive', text: 'War with the Ottoman Empire, which suffers a severe civil-war stability penalty.' },
      { decision: 'union', option: 'alliance', text: 'Byzantium and Hungary form an alliance; Byzantine treasury receives Western subsidies.' },
    ],
  },
  {
    id: 'vienna-1683',
    title: 'The Gates of Vienna',
    subtitle: 'Central Europe, 1683',
    question: 'What if the Ottomans had taken Vienna in 1683?',
    mapKey: '1650', start: { y: 1683, m: 6 }, era: 'renaissance', artHue: 140,
    background: [
      'In July 1683 Grand Vizier Kara Mustafa Pasha besieged Vienna, capital of the Habsburg monarchy, with a large Ottoman army.',
      'On 12 September a relief army led by King Jan III Sobieski of Poland–Lithuania defeated the besiegers. The Great Turkish War followed, ending in 1699 with the Treaty of Karlowitz and the loss of Hungary.',
    ],
    sourcesNote: 'Background follows standard accounts (e.g. A. Wheatcroft, "The Enemy at the Gate", 2008). Borders: historical-basemaps 1650 (the nearest available dataset, labelled as approximate for 1683).',
    focusCountries: ['Ottoman Empire', 'Holy Roman Empire', 'Polish–Lithuanian Commonwealth', 'Venice', 'France', 'Tsardom of Muscovy'],
    recommended: 'Ottoman Empire',
    characters: [
      { name: 'Kara Mustafa Pasha', role: 'Ottoman Grand Vizier', years: '1634/35–1683', bio: 'Commanded the siege; executed after the defeat.', country: 'Ottoman Empire' },
      { name: 'Leopold I', role: 'Holy Roman Emperor', years: '1640–1705', bio: 'Fled Vienna during the siege.', country: 'Holy Roman Empire' },
      { name: 'Jan III Sobieski', role: 'King of Poland', years: '1629–1696', bio: 'Led the relief at the Battle of Vienna.', country: 'Polish–Lithuanian Commonwealth' },
      { name: 'Louis XIV', role: 'King of France', years: '1638–1715', bio: 'Rival of the Habsburgs; stayed out of the relief.', country: 'France' },
    ],
    originalTimeline: [
      { date: { y: 1683, m: 6 }, title: 'Siege of Vienna begins', text: 'The Ottoman army invests the city (14 July).', countries: ['Ottoman Empire', 'Holy Roman Empire'] },
      { date: { y: 1683, m: 8 }, title: 'Battle of Vienna', text: 'Sobieski\'s relief army routs the Ottomans (12 September).', countries: ['Polish–Lithuanian Commonwealth', 'Ottoman Empire'] },
      { date: { y: 1684, m: 2 }, title: 'Holy League', text: 'Habsburgs, Poland and Venice ally against the Ottomans.', countries: ['Holy Roman Empire', 'Polish–Lithuanian Commonwealth', 'Venice'] },
      { date: { y: 1699, m: 0 }, title: 'Treaty of Karlowitz', text: 'The Ottomans cede most of Hungary.', countries: ['Ottoman Empire'] },
    ],
    decisions: [
      { id: 'siege', question: 'How does the siege end?', context: 'September 1683.', options: [
        { id: 'relieved', label: 'Relieved by Sobieski (historical)', description: 'Ottoman defeat and counter-offensive.', historical: true },
        { id: 'falls', label: 'Vienna falls', description: 'The Ottomans take Vienna before the relief arrives.' },
      ] },
      { id: 'france', question: 'What does France do?', context: 'Louis XIV was hostile to the Habsburgs.', options: [
        { id: 'neutral', label: 'Neutral (historical)', description: 'France stays out.', historical: true },
        { id: 'opportunist', label: 'France attacks the Habsburgs', description: 'France exploits the crisis on the Rhine.' },
      ] },
    ],
    consequences: [
      { decision: 'siege', option: 'relieved', text: 'Ottoman morale and stability fall; a Holy League forms against them.' },
      { decision: 'siege', option: 'falls', text: 'The Vienna province passes to Ottoman control; Habsburg stability collapses.' },
      { decision: 'france', option: 'opportunist', text: 'France declares war on the Holy Roman Empire.' },
    ],
  },
  {
    id: 'inca-resists',
    title: 'Sun Over the Andes',
    subtitle: 'Tawantinsuyu, 1530',
    question: 'What if the Inca Empire had resisted the Spanish conquest?',
    mapKey: '1530', start: { y: 1530, m: 0 }, era: 'renaissance', artHue: 28,
    background: [
      'By 1530 the Inca Empire (Tawantinsuyu) stretched over 4,000 km along the Andes. Smallpox, spreading ahead of the Europeans, killed Emperor Huayna Capac and his heir around 1527.',
      'A civil war between his sons Huáscar and Atahualpa devastated the empire. Atahualpa had just won when Francisco Pizarro\'s small expedition captured him at Cajamarca in November 1532; he was executed in 1533.',
      'The conquest brought catastrophic demographic collapse from epidemics, war and forced labour.',
    ],
    sourcesNote: 'Background follows standard accounts (e.g. J. Hemming, "The Conquest of the Incas", 1970). Borders: historical-basemaps 1530.',
    sensitivity: 'The conquest and colonisation of the Americas involved mass death, enslavement and forced labour (e.g. the mita and encomienda). The simulation treats these as documented harms.',
    focusCountries: ['Inca Empire', 'Spain', 'Viceroyalty of New Spain', 'Portugal'],
    recommended: 'Inca Empire',
    characters: [
      { name: 'Atahualpa', role: 'Sapa Inca', years: 'c.1502–1533', bio: 'Won the civil war against Huáscar; captured at Cajamarca.', country: 'Inca Empire' },
      { name: 'Huáscar', role: 'Sapa Inca (rival)', years: 'c.1503–1532', bio: 'Ruled from Cusco; killed on Atahualpa\'s orders.', country: 'Inca Empire' },
      { name: 'Francisco Pizarro', role: 'Spanish conquistador', years: 'c.1478–1541', bio: 'Led the conquest of Peru.', country: 'Spain' },
      { name: 'Charles V', role: 'King of Spain, Holy Roman Emperor', years: '1500–1558', bio: 'Authorised the expedition.', country: 'Spain' },
    ],
    originalTimeline: [
      { date: { y: 1529, m: 0 }, title: 'Inca civil war', text: 'Huáscar and Atahualpa fight for the throne.', countries: ['Inca Empire'] },
      { date: { y: 1532, m: 10 }, title: 'Cajamarca', text: 'Pizarro captures Atahualpa (16 November).', countries: ['Inca Empire', 'Spain'] },
      { date: { y: 1533, m: 6 }, title: 'Execution of Atahualpa', text: 'Atahualpa is executed despite paying a huge ransom.', countries: ['Inca Empire'] },
      { date: { y: 1533, m: 10 }, title: 'Fall of Cusco', text: 'The Spanish enter the Inca capital.', countries: ['Inca Empire', 'Spain'] },
      { date: { y: 1572, m: 8 }, title: 'Fall of Vilcabamba', text: 'The last Inca state is destroyed; Túpac Amaru executed.', countries: ['Inca Empire'] },
    ],
    decisions: [
      { id: 'civilwar', question: 'Is the Inca civil war avoided?', context: 'The succession war weakened the empire just before contact.', options: [
        { id: 'war', label: 'Civil war (historical)', description: 'Severe instability and losses.', historical: true },
        { id: 'peace', label: 'Brothers share power', description: 'A negotiated division prevents the civil war.' },
      ] },
      { id: 'cajamarca', question: 'What happens at Cajamarca?', context: 'November 1532.', options: [
        { id: 'captured', label: 'Atahualpa captured (historical)', description: 'Spanish war against a leaderless empire.', historical: true },
        { id: 'ambush_fails', label: 'The ambush fails', description: 'Pizarro\'s expedition is destroyed; Spain must decide whether to send more.' },
      ] },
      { id: 'epidemic', question: 'How hard do European diseases hit?', context: 'Smallpox had already struck c.1527.', options: [
        { id: 'severe', label: 'Severe epidemics (historical)', description: 'Waves of smallpox and other diseases.', historical: true },
        { id: 'milder', label: 'Milder outbreaks', description: 'Epidemics still occur but with lower severity.' },
      ] },
    ],
    consequences: [
      { decision: 'civilwar', option: 'war', text: 'Inca stability and manpower start low.' },
      { decision: 'cajamarca', option: 'captured', text: 'Spain declares war on the Inca in 1532; Inca legitimacy collapses.' },
      { decision: 'cajamarca', option: 'ambush_fails', text: 'Spain\'s first expedition fails; Inca morale rises.' },
      { decision: 'epidemic', option: 'severe', text: 'A severe smallpox epidemic strikes the Inca Empire.' },
    ],
  },
];

export const SCENARIO_BY_ID: Record<string, ScenarioDefinition> = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

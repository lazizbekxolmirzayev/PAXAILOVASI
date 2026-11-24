// Place and nation names. Source data (historical-basemaps, Natural Earth) is English, so names are
// translated with a curated dictionary first, then word by word, then a Russian transliteration fallback.
// Uzbek proper nouns stay in Latin script (the Uzbek alphabet is Latin), with a few orthography fixes.
import type { Lang } from './index';

type Pair = [string, string]; // [uz, ru]
function table(src: string): Map<string, Pair> {
  const m = new Map<string, Pair>();
  for (const line of src.split('\n')) {
    const p = line.split('|').map((x) => x.trim());
    if (p.length >= 3 && p[0]) m.set(p[0].toLowerCase(), [p[1], p[2]]);
  }
  return m;
}

/** whole names */
const FULL = table(`
Ottoman Empire|Usmonlilar imperiyasi|Османская империя
Holy Roman Empire|Muqaddas Rim imperiyasi|Священная Римская империя
Roman Empire|Rim imperiyasi|Римская империя
Western Roman Empire|G‘arbiy Rim imperiyasi|Западная Римская империя
Eastern Roman Empire|Sharqiy Rim imperiyasi|Восточная Римская империя
Byzantine Empire|Vizantiya imperiyasi|Византийская империя
Russian Empire|Rossiya imperiyasi|Российская империя
Austrian Empire|Avstriya imperiyasi|Австрийская империя
Austro-Hungarian Empire|Avstriya-Vengriya imperiyasi|Австро-Венгерская империя
Austria Hungary|Avstriya-Vengriya|Австро-Венгрия
Achaemenid Empire|Ahamoniylar imperiyasi|Империя Ахеменидов
Timurid Empire|Temuriylar imperiyasi|Империя Тимуридов
Mughal Empire|Boburiylar imperiyasi|Империя Великих Моголов
Safavid Empire|Safaviylar imperiyasi|Империя Сефевидов
Manchu Empire|Manjur imperiyasi|Маньчжурская империя
Ming Empire|Min imperiyasi|Империя Мин
Ming Chinese Empire|Min imperiyasi|Империя Мин
Khmer Empire|Xmer imperiyasi|Кхмерская империя
Srivijaya Empire|Shrivijaya imperiyasi|Империя Шривиджая
Carolingian Empire|Karolinglar imperiyasi|Империя Каролингов
Empire of Japan|Yaponiya imperiyasi|Японская империя
Inca Empire|Inklar imperiyasi|Империя инков
Mamluke Sultanate|Mamluklar sultonligi|Мамлюкский султанат
Abbasid Caliphate|Abbosiylar xalifaligi|Аббасидский халифат
Fatimid Caliphate|Fotimiylar xalifaligi|Фатимидский халифат
Hafsid Caliphate|Hafsiylar xalifaligi|Хафсидский халифат
Bulgar Khanate|Bulg‘or xonligi|Булгарское ханство
Chagatai Khanate|Chig‘atoy ulusi|Чагатайский улус
Ilkhanate|Elxonlar davlati|Государство Ильханов
Great Khanate|Buyuk xonlik|Великое ханство
Khanate of the Golden Horde|Oltin O‘rda|Золотая Орда
Golden Horde|Oltin O‘rda|Золотая Орда
Yuan Dynasty|Yuan sulolasi|Династия Юань
Northern Yuan|Shimoliy Yuan|Северная Юань
Joseon|Chosŏn|Чосон
Goryeo|Koryo|Корё
Lan Xang|Lan Sang|Лансанг
Đại Việt|Dai Viet|Дайвьет
Kingdom of England|Angliya qirolligi|Королевство Англия
United Kingdom|Buyuk Britaniya|Великобритания
United Kingdom of Great Britain and Ireland|Buyuk Britaniya va Irlandiya Birlashgan Qirolligi|Соединённое Королевство Великобритании и Ирландии
Kingdom of Prussia|Prussiya qirolligi|Королевство Пруссия
Viceroyalty of New Spain|Yangi Ispaniya noibligi|Вице-королевство Новая Испания
Viceroyalty of Peru|Peru noibligi|Вице-королевство Перу
Denmark-Norway|Daniya-Norvegiya|Дания-Норвегия
Poland-Lithuania|Polsha-Litva|Польша-Литва
British Raj|Britaniya Hindistoni|Британская Индия
Dutch East Indies|Niderland Sharqiy Hindistoni|Голландская Ост-Индия
French West Africa|Fransiya G‘arbiy Afrikasi|Французская Западная Африка
USSR|SSSR|СССР
Buwayhid Emirates|Buvayhiylar amirliklari|Эмираты Бувайхидов
Tanzania, United Republic of|Tanzaniya Birlashgan Respublikasi|Объединённая Республика Танзания
Korea, Democratic People's Republic of|Koreya Xalq Demokratik Respublikasi|КНДР
United States of America|Amerika Qo‘shma Shtatlari|Соединённые Штаты Америки
United States|Amerika Qo‘shma Shtatlari|Соединённые Штаты Америки
Maya chiefdoms and states|Mayya qabila boshliqliklari va davlatlari|Вождества и государства майя
West African cereal farmers|G‘arbiy Afrikadagi g‘alla dehqonlari|Западноафриканские зерновые земледельцы
Khoisan|Xoysanlar|Койсанские народы
Bantu peoples|Bantu xalqlari|Народы банту
Pampas cultures|Pampa madaniyatlari|Культуры пампасов
Saharan pastoral nomads|Sahroi Kabir chorvador ko‘chmanchilari|Скотоводы-кочевники Сахары
Afghanistan|Afg‘oniston|Афганистан
Albania|Albaniya|Албания
Algeria|Jazoir|Алжир
Andorra|Andorra|Андорра
Angola|Angola|Ангола
Argentina|Argentina|Аргентина
Armenia|Armaniston|Армения
Australia|Avstraliya|Австралия
Austria|Avstriya|Австрия
Azerbaijan|Ozarbayjon|Азербайджан
Bahrain|Bahrayn|Бахрейн
Bangladesh|Bangladesh|Бангладеш
Belarus|Belarus|Беларусь
Belgium|Belgiya|Бельгия
Belize|Beliz|Белиз
Benin|Benin|Бенин
Bhutan|Butan|Бутан
Bolivia|Boliviya|Боливия
Bosnia and Herzegovina|Bosniya va Gertsegovina|Босния и Герцеговина
Botswana|Botsvana|Ботсвана
Brazil|Braziliya|Бразилия
Brunei|Bruney|Бруней
Bulgaria|Bolgariya|Болгария
Burkina Faso|Burkina-Faso|Буркина-Фасо
Burundi|Burundi|Бурунди
Cambodia|Kambodja|Камбоджа
Cameroon|Kamerun|Камерун
Canada|Kanada|Канада
Cape Verde|Kabo-Verde|Кабо-Верде
Central African Republic|Markaziy Afrika Respublikasi|Центральноафриканская Республика
Chad|Chad|Чад
Chile|Chili|Чили
China|Xitoy|Китай
Colombia|Kolumbiya|Колумбия
Comoros|Komor orollari|Коморы
Costa Rica|Kosta-Rika|Коста-Рика
Croatia|Xorvatiya|Хорватия
Cuba|Kuba|Куба
Cyprus|Kipr|Кипр
Czech Republic|Chexiya|Чехия
Democratic Republic of the Congo|Kongo Demokratik Respublikasi|Демократическая Республика Конго
Republic of the Congo|Kongo Respublikasi|Республика Конго
Denmark|Daniya|Дания
Djibouti|Jibuti|Джибути
Dominican Republic|Dominikan Respublikasi|Доминиканская Республика
East Timor|Sharqiy Timor|Восточный Тимор
Ecuador|Ekvador|Эквадор
Egypt|Misr|Египет
El Salvador|Salvador|Сальвадор
Equatorial Guinea|Ekvatorial Gvineya|Экваториальная Гвинея
Eritrea|Eritreya|Эритрея
Estonia|Estoniya|Эстония
Ethiopia|Efiopiya|Эфиопия
Fiji|Fiji|Фиджи
Finland|Finlyandiya|Финляндия
France|Fransiya|Франция
Gabon|Gabon|Габон
Gambia|Gambiya|Гамбия
Georgia|Gruziya|Грузия
Germany|Germaniya|Германия
Ghana|Gana|Гана
Greece|Gretsiya|Греция
Greenland|Grenlandiya|Гренландия
Guatemala|Gvatemala|Гватемала
Guinea|Gvineya|Гвинея
Guinea Bissau|Gvineya-Bisau|Гвинея-Бисау
Guyana|Gayana|Гайана
Haiti|Gaiti|Гаити
Honduras|Gonduras|Гондурас
Hungary|Vengriya|Венгрия
Iceland|Islandiya|Исландия
India|Hindiston|Индия
Indonesia|Indoneziya|Индонезия
Iran|Eron|Иран
Iraq|Iroq|Ирак
Ireland|Irlandiya|Ирландия
Israel|Isroil|Израиль
Italy|Italiya|Италия
Ivory Coast|Kot-d‘Ivuar|Кот-д’Ивуар
Jamaica|Yamayka|Ямайка
Japan|Yaponiya|Япония
Jordan|Iordaniya|Иордания
Kazakhstan|Qozog‘iston|Казахстан
Kenya|Keniya|Кения
Kosovo|Kosovo|Косово
Kuwait|Kuvayt|Кувейт
Kyrgyzstan|Qirg‘iziston|Киргизия
Laos|Laos|Лаос
Latvia|Latviya|Латвия
Lebanon|Livan|Ливан
Lesotho|Lesoto|Лесото
Liberia|Liberiya|Либерия
Libya|Liviya|Ливия
Lybia|Liviya|Ливия
Liechtenstein|Lixtenshteyn|Лихтенштейн
Lithuania|Litva|Литва
Luxembourg|Lyuksemburg|Люксембург
Macedonia|Makedoniya|Македония
Madagascar|Madagaskar|Мадагаскар
Malawi|Malavi|Малави
Malaysia|Malayziya|Малайзия
Maldives|Maldiv orollari|Мальдивы
Mali|Mali|Мали
Malta|Malta|Мальта
Mauritania|Mavritaniya|Мавритания
Mauritius|Mavrikiy|Маврикий
Mexico|Meksika|Мексика
Moldova|Moldova|Молдавия
Monaco|Monako|Монако
Mongolia|Mo‘g‘uliston|Монголия
Montenegro|Chernogoriya|Черногория
Morocco|Marokash|Марокко
Mozambique|Mozambik|Мозамбик
Myanmar|Myanma|Мьянма
Namibia|Namibiya|Намибия
Nepal|Nepal|Непал
Netherlands|Niderlandiya|Нидерланды
New Zealand|Yangi Zelandiya|Новая Зеландия
Nicaragua|Nikaragua|Никарагуа
Niger|Niger|Нигер
Nigeria|Nigeriya|Нигерия
North Korea|Shimoliy Koreya|Северная Корея
Norway|Norvegiya|Норвегия
Oman|Ummon|Оман
Pakistan|Pokiston|Пакистан
Panama|Panama|Панама
Papua New Guinea|Papua — Yangi Gvineya|Папуа — Новая Гвинея
Paraguay|Paragvay|Парагвай
Peru|Peru|Перу
Philippines|Filippin|Филиппины
Poland|Polsha|Польша
Portugal|Portugaliya|Португалия
Puerto Rico|Puerto-Riko|Пуэрто-Рико
Qatar|Qatar|Катар
Romania|Ruminiya|Румыния
Russia|Rossiya|Россия
Rwanda|Ruanda|Руанда
Saudi Arabia|Saudiya Arabistoni|Саудовская Аравия
Senegal|Senegal|Сенегал
Serbia|Serbiya|Сербия
Republic of Serbia|Serbiya Respublikasi|Республика Сербия
Seychelles|Seyshel orollari|Сейшельские Острова
Sierra Leone|Syerra-Leone|Сьерра-Леоне
Singapore|Singapur|Сингапур
Slovakia|Slovakiya|Словакия
Slovenia|Sloveniya|Словения
Solomon Islands|Solomon orollari|Соломоновы Острова
Somalia|Somali|Сомали
Somaliland|Somalilend|Сомалиленд
South Africa|Janubiy Afrika|Южная Африка
South Korea|Janubiy Koreya|Южная Корея
Spain|Ispaniya|Испания
Sri Lanka|Shri-Lanka|Шри-Ланка
Sudan|Sudan|Судан
Suriname|Surinam|Суринам
Swaziland|Esvatini|Эсватини
Sweden|Shvetsiya|Швеция
Switzerland|Shveytsariya|Швейцария
Syria|Suriya|Сирия
Taiwan|Tayvan|Тайвань
Tajikistan|Tojikiston|Таджикистан
Thailand|Tailand|Таиланд
The Bahamas|Bagam orollari|Багамы
Togo|Togo|Того
Tonga|Tonga|Тонга
Trinidad and Tobago|Trinidad va Tobago|Тринидад и Тобаго
Tunisia|Tunis|Тунис
Turkey|Turkiya|Турция
Turkmenistan|Turkmaniston|Туркмения
Uganda|Uganda|Уганда
Ukraine|Ukraina|Украина
United Arab Emirates|Birlashgan Arab Amirliklari|Объединённые Арабские Эмираты
Uruguay|Urugvay|Уругвай
Uzbekistan|O‘zbekiston|Узбекистан
Vatican|Vatikan|Ватикан
Venezuela|Venesuela|Венесуэла
Vietnam|Vyetnam|Вьетнам
Western Sahara|G‘arbiy Sahroi Kabir|Западная Сахара
Yemen|Yaman|Йемен
Zambia|Zambiya|Замбия
Zimbabwe|Zimbabve|Зимбабве
Persia|Fors|Персия
Egypt, Arab Republic of|Misr Arab Respublikasi|Арабская Республика Египет
Ceylon|Seylon|Цейлон
Tibet|Tibet|Тибет
Korea|Koreya|Корея
Yugoslavia|Yugoslaviya|Югославия
Sardinia|Sardiniya|Сардиния
Sicily|Sitsiliya|Сицилия
Wales|Uels|Уэльс
England|Angliya|Англия
Scotland|Shotlandiya|Шотландия
Britain|Britaniya|Британия
Great Britain|Buyuk Britaniya|Великобритания
Moscow|Moskva|Москва
Constantinople|Konstantinopol|Константинополь
Istanbul|Istanbul|Стамбул
Samarkand|Samarqand|Самарканд
Bukhara|Buxoro|Бухара
Tashkent|Toshkent|Ташкент
Khiva|Xiva|Хива
Kabul|Kobul|Кабул
Baghdad|Bag‘dod|Багдад
Damascus|Damashq|Дамаск
Cairo|Qohira|Каир
Mecca|Makka|Мекка
Medina|Madina|Медина
Jerusalem|Quddus|Иерусалим
Athens|Afina|Афины
Rome|Rim|Рим
Venice|Venetsiya|Венеция
Paris|Parij|Париж
London|London|Лондон
Vienna|Vena|Вена
Prague|Praga|Прага
Warsaw|Varshava|Варшава
Kyiv|Kiyev|Киев
Beijing|Pekin|Пекин
Nanjing|Nankin|Нанкин
Delhi|Dehli|Дели
Tehran|Tehron|Тегеран
Isfahan|Isfahon|Исфахан
Tabriz|Tabriz|Тебриз
Herat|Hirot|Герат
Merv|Marv|Мерв
Otrar|O‘tror|Отрар
Kazan|Qozon|Казань
Astrakhan|Astraxan|Астрахань
Novgorod|Novgorod|Новгород
Lisbon|Lissabon|Лиссабон
Madrid|Madrid|Мадрид
Berlin|Berlin|Берлин
`);

/** nouns that head a name: [uz base, uz possessive, ru nominative, ru gender] */
const NOUNS = new Map<string, [string, string, string, 'f' | 'm' | 'n']>(Object.entries({
  empire: ['imperiya', 'imperiyasi', 'империя', 'f'], kingdom: ['qirollik', 'qirolligi', 'королевство', 'n'], khanate: ['xonlik', 'xonligi', 'ханство', 'n'],
  caliphate: ['xalifalik', 'xalifaligi', 'халифат', 'm'], sultanate: ['sultonlik', 'sultonligi', 'султанат', 'm'], emirate: ['amirlik', 'amirligi', 'эмират', 'm'],
  emirates: ['amirliklar', 'amirliklari', 'эмираты', 'm'], republic: ['respublika', 'respublikasi', 'республика', 'f'], principality: ['knyazlik', 'knyazligi', 'княжество', 'n'],
  duchy: ['gersoglik', 'gersogligi', 'герцогство', 'n'], dynasty: ['sulola', 'sulolasi', 'династия', 'f'], horde: ['o‘rda', 'o‘rdasi', 'орда', 'f'], union: ['ittifoq', 'ittifoqi', 'союз', 'm'],
  confederacy: ['konfederatsiya', 'konfederatsiyasi', 'конфедерация', 'f'], protectorate: ['protektorat', 'protektorati', 'протекторат', 'm'], viceroyalty: ['noiblik', 'noibligi', 'вице-королевство', 'n'],
  colony: ['mustamlaka', 'mustamlakasi', 'колония', 'f'], commonwealth: ['hamdo‘stlik', 'hamdo‘stligi', 'содружество', 'n'], islands: ['orollar', 'orollari', 'острова', 'm'],
  territory: ['hudud', 'hududi', 'территория', 'f'], raj: ['raj', 'raji', 'радж', 'm'], states: ['davlatlar', 'davlatlari', 'государства', 'n'], state: ['davlat', 'davlati', 'государство', 'n'],
  kingdoms: ['qirolliklar', 'qirolliklari', 'королевства', 'n'], khanates: ['xonliklar', 'xonliklari', 'ханства', 'n'], tribes: ['qabilalar', 'qabilalari', 'племена', 'n'],
  chiefdoms: ['qabila boshliqliklari', 'qabila boshliqliklari', 'вождества', 'n'], city: ['shahar', 'shahri', 'город', 'm'], culture: ['madaniyat', 'madaniyati', 'культура', 'f'], cultures: ['madaniyatlar', 'madaniyatlari', 'культуры', 'f'],
  coast: ['sohil', 'sohili', 'берег', 'm'], land: ['yer', 'yeri', 'земля', 'f'],
}));
/** adjectives: [uz, ru stem, feminine, neuter, masculine] */
const ADJ = new Map<string, [string, string, string, string, string]>(Object.entries({
  united: ['Birlashgan', 'Объединённ', 'ая', 'ое', 'ый'], great: ['Buyuk', 'Велик', 'ая', 'ое', 'ий'], grand: ['Buyuk', 'Велик', 'ая', 'ое', 'ий'], holy: ['Muqaddas', 'Свят', 'ая', 'ое', 'ой'],
  roman: ['Rim', 'Римск', 'ая', 'ое', 'ий'], byzantine: ['Vizantiya', 'Византийск', 'ая', 'ое', 'ий'], ottoman: ['Usmonli', 'Османск', 'ая', 'ое', 'ий'], mongol: ['Mo‘g‘ul', 'Монгольск', 'ая', 'ое', 'ий'],
  persian: ['Fors', 'Персидск', 'ая', 'ое', 'ий'], golden: ['Oltin', 'Золот', 'ая', 'ое', 'ой'], white: ['Oq', 'Бел', 'ая', 'ое', 'ый'], blue: ['Ko‘k', 'Син', 'яя', 'ее', 'ий'], red: ['Qizil', 'Красн', 'ая', 'ое', 'ый'],
  western: ['G‘arbiy', 'Западн', 'ая', 'ое', 'ый'], eastern: ['Sharqiy', 'Восточн', 'ая', 'ое', 'ый'], northern: ['Shimoliy', 'Северн', 'ая', 'ое', 'ый'], southern: ['Janubiy', 'Южн', 'ая', 'ое', 'ый'],
  central: ['Markaziy', 'Центральн', 'ая', 'ое', 'ый'], upper: ['Yuqori', 'Верхн', 'яя', 'ее', 'ий'], lower: ['Quyi', 'Нижн', 'яя', 'ее', 'ий'], new: ['Yangi', 'Нов', 'ая', 'ое', 'ый'], old: ['Qadimgi', 'Стар', 'ая', 'ое', 'ый'],
  british: ['Britaniya', 'Британск', 'ая', 'ое', 'ий'], french: ['Fransuz', 'Французск', 'ая', 'ое', 'ий'], spanish: ['Ispan', 'Испанск', 'ая', 'ое', 'ий'], portuguese: ['Portugal', 'Португальск', 'ая', 'ое', 'ий'],
  dutch: ['Niderland', 'Голландск', 'ая', 'ое', 'ий'], german: ['Nemis', 'Германск', 'ая', 'ое', 'ий'], austrian: ['Avstriya', 'Австрийск', 'ая', 'ое', 'ий'], russian: ['Rossiya', 'Российск', 'ая', 'ое', 'ий'],
  chinese: ['Xitoy', 'Китайск', 'ая', 'ое', 'ий'], indian: ['Hind', 'Индийск', 'ая', 'ое', 'ий'], hindu: ['Hind', 'Индуистск', 'ая', 'ое', 'ий'], islamic: ['Islom', 'Исламск', 'ая', 'ое', 'ий'],
  imperial: ['Imperator', 'Имперск', 'ая', 'ое', 'ий'], asian: ['Osiyo', 'Азиатск', 'ая', 'ое', 'ий'], african: ['Afrika', 'Африканск', 'ая', 'ое', 'ий'], american: ['Amerika', 'Американск', 'ая', 'ое', 'ий'],
  andean: ['And', 'Андск', 'ая', 'ое', 'ий'], minor: ['Kichik', 'Малая', 'ая', 'ое', 'ый'], northwestern: ['Shimoli-g‘arbiy', 'Северо-Западн', 'ая', 'ое', 'ый'],
}));
/** single words */
const WORDS = table(`
of|—|
and|va|и
the||
hunter-gatherers|ovchi-terimchilar|охотники-собиратели
hunter|ovchi|охотник
gatherers|terimchilar|собиратели
farmers|dehqonlar|земледельцы
pastoral|chorvador|скотоводческие
nomads|ko‘chmanchilar|кочевники
peoples|xalqlar|народы
people|xalq|народ
marine|dengiz|морские
mammal|sutemizuvchi|млекопитающие
hunters|ovchilar|охотники
saint|Muqaddas|Сент
san|San|Сан
santa|Santa|Санта
south|Janubiy|Южная
north|Shimoliy|Северная
east|Sharqiy|Восточная
west|G‘arbiy|Западная
sea|dengiz|море
island|orol|остров
mountains|tog‘lar|горы
river|daryo|река
lake|ko‘l|озеро
gulf|qo‘ltiq|залив
bay|ko‘rfaz|бухта
cape|burun|мыс
port|port|порт
fort|qal‘a|форт
coast|sohil|берег
del|del|дель
de|de|де
la|la|ля
el|el|эль
al|al|аль
`);

const RU_DIGRAPHS: [string, string][] = [
  ['tsch', 'ч'], ['sch', 'ш'], ['tch', 'ч'], ['sh', 'ш'], ['ch', 'ч'], ['kh', 'х'], ['zh', 'ж'], ['th', 'т'], ['ph', 'ф'], ['gh', 'г'], ['ck', 'к'], ['qu', 'кв'], ['ts', 'ц'], ['dj', 'дж'],
  ['ou', 'у'], ['oo', 'у'], ['ee', 'и'], ['ea', 'и'], ['ai', 'ай'], ['ay', 'ей'], ['ey', 'ей'], ['ie', 'и'], ['au', 'ау'], ['aw', 'о'], ['ya', 'я'], ['yu', 'ю'], ['yo', 'ё'], ['ye', 'е'],
  ['ng', 'нг'],
];
const RU_LETTERS: Record<string, string> = { a: 'а', b: 'б', c: 'к', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'дж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'кс', y: 'и', z: 'з' };
const FOLD: Record<string, string> = { á: 'a', à: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', í: 'i', ì: 'i', î: 'i', ï: 'i', ó: 'o', ò: 'o', ô: 'o', ö: 'o', õ: 'o', ú: 'u', ù: 'u', û: 'u', ü: 'u', ç: 's', ñ: 'ny', ý: 'y', ž: 'zh', š: 'sh', č: 'ch', ł: 'l', ø: 'o', đ: 'd', ā: 'a', ī: 'i', ū: 'u', ō: 'o', ē: 'e' };

function toRussian(word: string): string {
  let s = word.toLowerCase().replace(/[’'`]/g, '').replace(/./g, (ch) => FOLD[ch] ?? ch);
  let out = '';
  for (let i = 0; i < s.length;) {
    let hit = false;
    for (const [from, to] of RU_DIGRAPHS) {
      if (s.startsWith(from, i)) { out += to; i += from.length; hit = true; break; }
    }
    if (hit) continue;
    const ch = s[i];
    if (ch === 'c' && /[eiy]/.test(s[i + 1] ?? '')) out += 'с';
    else if (ch === 'y' && i === s.length - 1) out += 'и';
    else if (ch === 'g' && i === s.length - 1 && s[i - 1] === 'n') out += 'г';
    else out += RU_LETTERS[ch] ?? ch;
    i++;
  }
  out = out.replace(/(.)\1+/g, (m, c) => (/[аеёиоуыэюя]/.test(c) ? m : c)).replace(/йй+/g, 'й');
  return out.charAt(0).toUpperCase() + out.slice(1);
}
function toUzbek(word: string): string {
  let s = word.replace(/kh/g, 'x').replace(/Kh/g, 'X').replace(/gh/g, 'g‘').replace(/sch/g, 'sh').replace(/w/g, 'v').replace(/W/g, 'V');
  s = s.replace(/’|'/g, '’');
  return s;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function word(lang: 'uz' | 'ru', raw: string): string {
  const k = raw.toLowerCase();
  const w = WORDS.get(k);
  if (w) return lang === 'uz' ? w[0] : w[1];
  if (raw.includes('-')) return raw.split('-').map((p) => word(lang, p)).join('-');
  const f = FULL.get(k);
  if (f) return lang === 'uz' ? f[0] : f[1];
  const a = ADJ.get(k);
  if (a) return lang === 'uz' ? a[0] : a[1] + a[4];
  const n = NOUNS.get(k);
  if (n) return lang === 'uz' ? cap(n[0]) : cap(n[2]);
  if (/^\d+$/.test(raw)) return raw;
  return lang === 'uz' ? toUzbek(raw) : toRussian(raw);
}

function phrase(lang: 'uz' | 'ru', tokens: string[]): string {
  if (!tokens.length) return '';
  const last = tokens[tokens.length - 1].toLowerCase();
  const noun = NOUNS.get(last);
  const rest = tokens.slice(0, -1);
  if (noun && rest.length) {
    if (lang === 'uz') {
      // "Timurid Empire" -> "Timurid imperiyasi"; leading proper nouns stay as they are
      return `${rest.map((t) => word('uz', t)).join(' ')} ${noun[1]}`;
    }
    // "Golden Horde" -> "Золотая Орда"; unknown modifier -> "Империя Тимурид"
    const adj = ADJ.get(rest[rest.length - 1].toLowerCase());
    if (adj && rest.length === 1) { const end = noun[3] === 'f' ? adj[2] : noun[3] === 'n' ? adj[3] : adj[4]; return `${adj[1]}${end} ${noun[2]}`.replace(/^./, (c) => c.toUpperCase()); }
    if (adj) { const end = noun[3] === 'f' ? adj[2] : noun[3] === 'n' ? adj[3] : adj[4]; return `${rest.slice(0, -1).map((t) => word('ru', t)).join(' ')} ${adj[1]}${end} ${noun[2]}`; }
    return `${cap(noun[2])} ${rest.map((t) => word('ru', t)).join(' ')}`;
  }
  return tokens.map((t) => word(lang, t)).join(' ');
}

const cache = new Map<string, string>();
/** Translates a place or nation name for the given UI language. English returns the name unchanged. */
export function translateName(lang: Lang, name: string): string {
  if (lang === 'en' || !name) return name;
  const key = `${lang}:${name}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const L = lang as 'uz' | 'ru';
  let out: string;
  const full = FULL.get(name.toLowerCase());
  if (full) out = L === 'uz' ? full[0] : full[1];
  else {
    // keep punctuation and bracketed parts: translate each chunk separately
    out = name.split(/(\s*[()/,]\s*)/).map((chunk) => {
      if (!chunk || /^\s*[()/,]\s*$/.test(chunk)) return chunk;
      const c = chunk.trim();
      const f = FULL.get(c.toLowerCase());
      if (f) return L === 'uz' ? f[0] : f[1];
      const m = c.match(/^(.+?) of (?:the )?(.+)$/i);
      if (m) {
        const headTokens = m[1].split(/\s+/);
        const tail = translateName(lang, m[2]);
        const noun = NOUNS.get(headTokens[headTokens.length - 1].toLowerCase());
        if (noun) {
          if (L === 'uz') return `${tail} ${headTokens.slice(0, -1).map((t) => word('uz', t)).concat(noun[1]).join(' ')}`;
          const adj = headTokens.length > 1 ? ADJ.get(headTokens[0].toLowerCase()) : undefined;
          const end = adj ? (noun[3] === 'f' ? adj[2] : noun[3] === 'n' ? adj[3] : adj[4]) : '';
          return `${adj ? cap(adj[1] + end) + ' ' + noun[2] : cap(noun[2])} ${tail}`;
        }
        return `${phrase(L, headTokens)} ${L === 'uz' ? '' : ''}${tail}`.trim();
      }
      return phrase(L, c.split(/\s+/));
    }).join('');
  }
  if (cache.size > 6000) cache.clear();
  cache.set(key, out);
  return out;
}

/** Exact whole-name lookup (no guessing): used by the page-wide DOM translator. */
export function lookupFullName(lang: Lang, name: string): string | null {
  if (lang === 'en') return null;
  const f = FULL.get(name.toLowerCase());
  return f ? (lang === 'uz' ? f[0] : f[1]) : null;
}

// additional whole names (scenario data)
for (const [k, uz, ru] of [
  ['Kingdom of Hungary', 'Vengriya qirolligi', 'Королевство Венгрия'],
  ['Polish–Lithuanian Commonwealth', 'Polsha–Litva Hamdo‘stligi', 'Речь Посполитая'],
  ['Tsardom of Muscovy', 'Moskva podshohligi', 'Московское царство'],
  ['Sultanate of Delhi', 'Dehli sultonligi', 'Делийский султанат'],
  ['Prussia', 'Prussiya', 'Пруссия'],
  ['Hunnic Empire', 'Hunnlar imperiyasi', 'Империя гуннов'],
  ['Visigoths', 'Vestgotlar', 'Вестготы'],
  ['Franks', 'Franklar', 'Франки'],
  ['Trebizond', 'Trabzon imperiyasi', 'Трапезундская империя'],
  ['Mamluk Sultanate', 'Mamluklar sultonligi', 'Мамлюкский султанат'],
  ['Sasanian Empire', 'Sosoniylar imperiyasi', 'Государство Сасанидов'],
  ['Vandals', 'Vandallar', 'Вандалы'],
  ['Ostrogoths', 'Ostgotlar', 'Остготы'],
] as const) FULL.set(k.toLowerCase(), [uz, ru]);

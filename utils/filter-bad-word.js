// Source https://raw.githubusercontent.com/lamhotsimamora/Filter-Kata-Kotor/master/filter-bad-word.js
// License https://raw.githubusercontent.com/lamhotsimamora/Filter-Kata-Kotor/master/LICENSE
const _badWord = [
  "Anjing",
  "Babi",
  "Kunyuk",
  "Bajingan",
  "Asu",
  "Bangsat",
  "Kampret",
  "Kontol",
  "Memek",
  "Ngentot",
  "Pentil",
  "Perek",
  "Pepek",
  "Pecun",
  "Bencong",
  "Banci",
  "Maho",
  "Gila",
  "Sinting",
  "Tolol",
  "Sarap",
  "Setan",
  "Lonte",
  "Hencet",
  "Taptei",
  "Kampang",
  "Pilat",
  "Keparat",
  "Bejad",
  "Gembel",
  "Brengsek",
  "Tai",
  "Anjrit",
  "Bangsat",
  "Fuck",
  "Tetek",
  "Ngulum",
  "Jembut",
  "Totong",
  "Kolop",
  "Pukimak",
  "Bodat",
  "Heang",
  "Jancuk",
  "Burit",
  "Titit",
  "Nenen",
  "Bejat",
  "Silit",
  "Sempak",
  "Fucking",
  "Asshole",
  "Bitch",
  "Penis",
  "Vagina",
  "Klitoris",
  "Kelentit",
  "Borjong",
  "Dancuk",
  "Pantek",
  "Taek",
  "Itil",
  "Teho",
  "Bejat",
  "Pantat",
  "Bagudung",
  "Babami",
  "Kanciang",
  "Bungul",
  "Idiot",
  "Kimak",
  "Henceut",
  "Kacuk",
  "Blowjob",
  "Pussy",
  "Dick",
  "Damn",
  "Ass",
];
String.prototype._replaceAllString = function (s, r) {
  return this.split(s).join(r);
};
function _filterBadWord(str, txt, dt) {
  if (str) {
    var str = str.toLowerCase();
    txt = txt ? txt : "***";
    dt = dt ? dt : _badWord;
    for (var i = 0; i < dt.length; i++) {
      var kk = dt[i].toLowerCase();
      var ii = str.search(kk);
      if (ii != -1) {
        str = str._replaceAllString(kk, txt);
      }
    }
    return str;
  } else {
    return undefined;
  }
}
global._filterBadWord = _filterBadWord;

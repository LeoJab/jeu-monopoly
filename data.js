// Données du jeu : toutes les personnalisations de Léo sont ici.
const GAME = {
  title: 'Molopony',
  bank: 'La Banque',
  mascot: 'Lenaic',
  startMoney: 1500,
  salary: 200,
  jailFine: 50,
  maxJailTurns: 3,
  mortgageInterest: 0.10,
  houseStock: 32,
  hotelStock: 12,
};

const GROUPS = {
  brown:  { name: 'Marron',     color: '#8b5a2b', house: 50 },
  lblue:  { name: 'Bleu clair', color: '#9fdcf5', house: 50 },
  pink:   { name: 'Rose',       color: '#e0489a', house: 100 },
  orange: { name: 'Orange',     color: '#f7931e', house: 100 },
  red:    { name: 'Rouge',      color: '#e0262b', house: 150 },
  yellow: { name: 'Jaune',      color: '#ffd426', house: 150 },
  green:  { name: 'Vert',       color: '#1fa855', house: 200 },
  dblue:  { name: 'Bleu foncé', color: '#2433f2', house: 200 },
};

// type: go | street | rail | util | chance | chest | tax | jail | park | gojail
// rent = [nu, 1 maison, 2, 3, 4, villa]
const BOARD = [
  { t: 'go', name: 'Départ', icon: '➡️' },
  { t: 'street', g: 'brown', name: 'Boulevard de Rochefort', price: 60, rent: [2, 10, 30, 90, 160, 250] },
  { t: 'chest', name: 'Caisse de communauté' },
  { t: 'street', g: 'brown', name: 'Rue de Grattepanche', price: 60, rent: [4, 20, 60, 180, 320, 450] },
  { t: 'tax', name: 'Impôts sur le revenu', amount: 200, icon: '💸' },
  { t: 'rail', name: 'Gare du Havre', price: 200 },
  { t: 'street', g: 'lblue', name: "Rue de l'EMAC", price: 100, rent: [6, 30, 90, 270, 400, 550] },
  { t: 'chance', name: 'Chance' },
  { t: 'street', g: 'lblue', name: 'Rue de Bouquemaison', price: 100, rent: [6, 30, 90, 270, 400, 550] },
  { t: 'street', g: 'lblue', name: "Avenue d'Empuriabrava", price: 120, rent: [8, 40, 100, 300, 450, 600] },
  { t: 'jail', name: 'Hôtel', sub: 'Simple visite', icon: '🏨' },
  { t: 'street', g: 'pink', name: 'Boulevard de Angers', price: 140, rent: [10, 50, 150, 450, 625, 750] },
  { t: 'util', name: 'Esig Energies', price: 150, icon: '⚡' },
  { t: 'street', g: 'pink', name: 'Avenue de Metz', price: 140, rent: [10, 50, 150, 450, 625, 750] },
  { t: 'street', g: 'pink', name: 'Rue de Doullens', price: 160, rent: [12, 60, 180, 500, 700, 900] },
  { t: 'rail', name: 'Gare de Lyon', price: 200 },
  { t: 'street', g: 'orange', name: 'Avenue de Vaulx-en-Velin', price: 180, rent: [14, 70, 200, 550, 750, 950] },
  { t: 'chest', name: 'Caisse de communauté' },
  { t: 'street', g: 'orange', name: 'Boulevard de Cucq', price: 180, rent: [14, 70, 200, 550, 750, 950] },
  { t: 'street', g: 'orange', name: "Tunnel d'Arménie", price: 200, rent: [16, 80, 220, 600, 800, 1000] },
  { t: 'park', name: 'Parc gratuit', icon: '🌳' },
  { t: 'street', g: 'red', name: 'Avenue de Budapest', price: 220, rent: [18, 90, 250, 700, 875, 1050] },
  { t: 'chance', name: 'Chance' },
  { t: 'street', g: 'red', name: 'Boulevard de Lille', price: 220, rent: [18, 90, 250, 700, 875, 1050] },
  { t: 'street', g: 'red', name: 'Avenue de Grenoble', price: 240, rent: [20, 100, 300, 750, 925, 1100] },
  { t: 'rail', name: "Gare d'Amiens", price: 200 },
  { t: 'street', g: 'yellow', name: "Faubourg Saint Grégoire l'illuminateur", price: 260, rent: [22, 110, 330, 800, 975, 1150] },
  { t: 'street', g: 'yellow', name: 'Place Corneille', price: 260, rent: [22, 110, 330, 800, 975, 1150] },
  { t: 'util', name: 'Jack Ma Environment', price: 150, icon: '🚽' },
  { t: 'street', g: 'yellow', name: "Rue de l'UAC", price: 280, rent: [24, 120, 360, 850, 1025, 1200] },
  { t: 'gojail', name: "Allez à l'Hôtel", icon: '👮' },
  { t: 'street', g: 'green', name: 'Avenue des Ormeaux', price: 300, rent: [26, 130, 390, 900, 1100, 1275] },
  { t: 'street', g: 'green', name: "Avenue d'Albi", price: 300, rent: [26, 130, 390, 900, 1100, 1275] },
  { t: 'chest', name: 'Caisse de communauté' },
  { t: 'street', g: 'green', name: 'Boulevard de Trondheim', price: 320, rent: [28, 150, 450, 1000, 1200, 1400] },
  { t: 'rail', name: 'Gare de Rouen', price: 200 },
  { t: 'chance', name: 'Chance' },
  { t: 'street', g: 'dblue', name: 'Avenue Saint-Joseph', price: 350, rent: [35, 175, 500, 1100, 1300, 1500] },
  { t: 'tax', name: 'Taxe de luxe', amount: 100, icon: '💎' },
  { t: 'street', g: 'dblue', name: 'Rue de la Niche', price: 400, rent: [50, 200, 600, 1400, 1700, 2000] },
];

// Index utiles (pour les cartes qui envoient sur une rue précise)
const POS = {
  go: 0, rochefort: 1, angers: 11, lyon: 15, grenoble: 24, niche: 39, jail: 10,
};

// Actions : goto{to,collect} | move{n} | jail | jailcard | gain{n} | pay{n}
//           repair{house,villa} | birthday{n} | gainOrChance{n} | nearestRail
const CHANCE = [
  { txt: "Avancez jusqu'à la case Départ", a: 'goto', to: POS.go, collect: true },
  { txt: 'Rendez-vous Avenue de Grenoble', a: 'goto', to: POS.grenoble, collect: true },
  { txt: 'Avancez au Boulevard de Angers', a: 'goto', to: POS.angers, collect: true },
  { txt: 'Rendez-vous Rue de la Niche', a: 'goto', to: POS.niche, collect: true },
  { txt: 'Allez à la Gare de Lyon', a: 'goto', to: POS.lyon, collect: true },
  { txt: 'Reculez de trois cases', a: 'move', n: -3 },
  { txt: 'Vous êtes viré de votre WEI, direction l’Hôtel', a: 'jail' },
  { txt: 'Vous êtes libéré de l’Hôtel (carte à garder)', a: 'jailcard' },
  { txt: 'La banque vous verse un dividende de 50 €', a: 'gain', n: 50 },
  { txt: 'Vous avez gagné votre ALL IN RED : recevez 150 €', a: 'gain', n: 150 },
  { txt: 'Vous gagnez les championnats de CAPS : 200 €', a: 'gain', n: 200 },
  { txt: 'Réparations : 25 € par maison, 100 € par villa', a: 'repair', house: 25, villa: 100 },
  { txt: 'Réparation de voirie : 20 € par maison, 115 € par villa', a: 'repair', house: 20, villa: 115 },
  { txt: 'Vos lunettes étant trop petites, vous les changez pour 50 €', a: 'pay', n: 50 },
  { txt: 'Vous avez perdu votre ALL IN RED : payez 150 €', a: 'pay', n: 150 },
  { txt: 'Vous remboursez un pare-brise que vous avez saccagé : 100 €', a: 'pay', n: 100 },
];

const CHEST = [
  { txt: 'Placez-vous sur la case Départ', a: 'goto', to: POS.go, collect: true },
  { txt: 'Retournez au Boulevard de Rochefort', a: 'goto', to: POS.rochefort, collect: false },
  { txt: 'Allez à l’Hôtel', a: 'jail' },
  { txt: 'Vous êtes libéré de l’Hôtel (carte à garder)', a: 'jailcard' },
  { txt: "Bug d’ordinateur : recevez 200 €", a: 'gain', n: 200 },
  { txt: 'Vous faites de l’achat-revente de poppers et gagnez 50 €', a: 'gain', n: 50 },
  { txt: 'Vous gagnez vos paris sportifs sur le Tour de France : 125 €', a: 'gain', n: 125 },
  { txt: 'Vous revendez le cadeau d’un ami pour 50 €', a: 'gain', n: 50 },
  { txt: 'Vous trouvez un billet de 100 € par terre en cherchant les clés perdues d’un ami', a: 'gain', n: 100 },
  { txt: 'Vous subtilisez un billet de 50 € chez un ami pendant une soirée', a: 'gain', n: 50 },
  { txt: 'Deuxième prix de beauté : recevez 100 €', a: 'gain', n: 100 },
  { txt: 'C’est votre anniversaire : chaque joueur vous donne 100 €', a: 'birthday', n: 100 },
  { txt: 'Vous achetez les chaussettes sales de votre amie pour 50 €', a: 'pay', n: 50 },
  { txt: 'Vous étiez garé devant une sortie de garage et la fourrière vous facture 100 €', a: 'pay', n: 100 },
  { txt: 'Vous achetez un menu black and white burger, vous payez 50 €', a: 'pay', n: 50 },
  { txt: 'Gagnez 50 € ou tirez une carte Chance', a: 'gainOrChance', n: 50 },
];

// Pions : emoji, ou photo si img est défini
const TOKENS = [
  { id: 'vape',     name: 'Cigarette électrique', emoji: '💨', img: 'img/pions/vape.png' },
  { id: 'cap',      name: 'Casquette (à Simon)', emoji: '🧢', img: 'img/pions/cap.png' },
  { id: 'fifty',    name: 'Fifty le chien', emoji: '🐶', img: 'img/pions/fifty.png' },
  { id: 'slip',     name: 'Slip (sale et troué)', emoji: '🩲', img: 'img/pions/slip.png' },
  { id: 'nutella',  name: 'Pot de Nutella', emoji: '🫙', img: 'img/pions/nutella.png' },
  { id: 'bidon',    name: 'Bidon de cum', emoji: '🥛', img: 'img/pions/bidon.png' },
  { id: 'pringles', name: 'Boîte de Pringles', emoji: '🥫', img: 'img/pions/pringles.png' },
  { id: 'shoes',    name: 'Chaussures banales', emoji: '👟', img: 'img/pions/shoes.png' },
];

const PLAYER_COLORS = ['#e0262b', '#2433f2', '#1fa855', '#f7931e', '#e0489a', '#8b5a2b', '#12102b', '#7b2cbf'];

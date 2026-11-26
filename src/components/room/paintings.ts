// The three paintings above the record console, left to right (see scripts/build_paintings.py).
// Images are public-domain scans from Wikimedia Commons.

export type Painting = {
    id: string;
    title: string;
    /** The title in the painting's own language. */
    original: string;
    artist: string;
    /** The artist's name in their own language, when it isn't English. */
    artistNative?: string;
    lifespan: string;
    year: string;
    details: string;
    image: string;
    /** About the painting: what it shows and its story. */
    history: string[];
    /** About the painter. */
    about: string[];
    link: string;
};

export const PAINTINGS: Painting[] = [
    {
        id: 'gleaners',
        title: 'The Gleaners',
        original: 'Des glaneuses',
        artist: 'Jean-François Millet',
        lifespan: '1814–1875',
        year: '1857',
        details: 'Oil on canvas · 83.5 × 110 cm · Musée d’Orsay, Paris',
        image: 'paintings/gleaners.jpg',
        history: [
            'Three peasant women bend to pick up the stray ears of wheat left behind after the harvest. Gleaning was a right granted to the poorest families of a village, and one of the hardest jobs on the farm. Behind them, in the bright distance, the rich farm’s harvest goes on: tall haystacks, a loaded cart and a foreman on horseback keeping watch.',
            'Millet painted it on the plain near Barbizon, at the edge of the forest of Fontainebleau. When it was shown at the Paris Salon of 1857, less than ten years after the revolution of 1848, many critics were alarmed: painting the rural poor at the size usually kept for heroes and saints looked like a political statement. One critic wrote that behind the three gleaners he could see the pikes of the riots and the scaffolds of 1793. Today it is one of the best-loved paintings in the Musée d’Orsay.',
        ],
        about: [
            'Millet was born into a farming family in Gruchy, a hamlet on the coast of Normandy, and worked the fields himself as a young man. He trained in Cherbourg and then in Paris under Paul Delaroche, making a poor living from portraits.',
            'In 1849, escaping cholera and the turmoil in Paris, he moved to the village of Barbizon and stayed there for the rest of his life, painting the people who worked the land around him: The Sower, The Angelus, The Gleaners. A founder of the Barbizon school and a key figure of Realism, he gave peasants a quiet dignity that later painters, Van Gogh above all, admired and copied.',
        ],
        link: 'https://en.wikipedia.org/wiki/The_Gleaners',
    },
    {
        id: 'secret-school',
        title: 'The Secret School',
        original: 'Το Κρυφό Σχολειό',
        artist: 'Nikolaos Gyzis',
        artistNative: 'Νικόλαος Γύζης',
        lifespan: '1842–1901',
        year: '1885–86',
        details: 'Oil on canvas · Emfietzoglou Collection, Athens',
        image: 'paintings/secret-school.jpg',
        history: [
            'In the half-dark of what looks like a church crypt, an old priest raises a finger as he teaches a circle of boys. One copies onto a sheet on his knee, one in a fustanella holds a book, and at the back a young man with a rifle keeps watch by the door. The only light falls from a high window.',
            'Gyzis painted it in Munich and showed it in Athens at the Panhellenic Exhibition of 1888. It illustrates the krifo scholio, the schools that priests and monks are said to have run in secret during Ottoman rule, when Greek learning was supposedly forbidden. No other image did more to fix that story in Greek memory. Historians now argue that such clandestine schools were largely a later legend, since Greek schools did operate openly under the Ottomans, which has made the painting part of a long debate about how a nation remembers its past.',
        ],
        about: [
            'Gyzis was born in Sklavochori on Tinos, an island famous for its marble carvers. He studied at the School of Arts in Athens and in 1865 won a scholarship to the Munich Academy, where he studied under Karl von Piloty.',
            'He made Munich his home, taught at its Academy and became the leading figure of the "Munich School" of Greek painting. His work moves from warm scenes of Greek life, such as The Engagement (1877), to the allegorical, almost visionary paintings of his last years. He died in Munich in 1901.',
        ],
        link: 'https://en.wikipedia.org/wiki/Nikolaos_Gyzis',
    },
    {
        id: 'kalanta',
        title: 'The Carols',
        original: 'Τα Κάλαντα',
        artist: 'Nikiforos Lytras',
        artistNative: 'Νικηφόρος Λύτρας',
        lifespan: '1832–1904',
        year: '1872',
        details: 'Oil on canvas · 59 × 90 cm · private collection',
        image: 'paintings/kalanta.jpg',
        history: [
            'A band of boys goes from door to door singing the kalanta, the carols of Christmas, New Year and Epiphany. One beats a big drum, one plays a pipe, two read the verses from a sheet of paper and a lantern waits at their feet for the walk home. From the doorway a young mother with her child listens, and a boy peers over the wall behind them.',
            'Lytras painted it in 1872, and it became a model of Greek "ethographia": genre painting that recorded the everyday life of the young Greek state with the realism of the Munich Academy. It is probably the most reproduced Greek Christmas image, turning up on cards and in school books every December.',
        ],
        about: [
            'Lytras was born in Pyrgos on Tinos, the same island as Gyzis. He studied at the School of Arts in Athens and then at the Munich Academy under Karl von Piloty.',
            'Back in Athens in 1866, he became professor of painting at the School of Arts and taught there for almost forty years, training a whole generation of Greek painters. Besides scenes of everyday life like The Carols, he painted history pictures such as The Burning of the Turkish Flagship by Kanaris. With Gyzis, he is the central figure of the Greek Munich School.',
        ],
        link: 'https://en.wikipedia.org/wiki/Nikiforos_Lytras',
    },
];

export const paintingUrl = (painting: Painting) => `${import.meta.env.BASE_URL}${painting.image}`;

/** Blender parents each painting and its frame to "Painting <id>" (GLTFLoader turns spaces into underscores). */
const NODE_PREFIX = 'Painting_';

/** The painting an object in the room belongs to, if `name` is one of the paintings' nodes. */
export const paintingFor = (name: string) =>
    name.startsWith(NODE_PREFIX) ? PAINTINGS.find((p) => p.id === name.slice(NODE_PREFIX.length))?.id : undefined;

// Every album in the room: the framed sleeves on the wall and the loose records by the console.
// Tracklists from MusicBrainz (musicbrainz.org), cover art from the Cover Art Archive (coverartarchive.org),
// audio from each album's official release on YouTube Music.
/** `video` is the track's official audio on YouTube (from the album's YouTube Music release). */
export type Track = { title: string; video: string };

export type Album = {
    id: string;
    title: string;
    artist: string;
    year: string;
    cover: string;
    /**
     * Where it is in the room: framed on the wall, out on the floor by the console, or (by default)
     * filed in the record rack under the turntable. New records go in the rack.
     */
    place?: 'wall' | 'floor';
    tracks: Track[];
};

export const ALBUMS: Album[] = [
    {
        id: 'compton',
        title: 'Compton',
        artist: 'Dr. Dre',
        year: '2015',
        cover: 'covers/compton.jpg',
        place: 'floor',
        tracks: [
            { title: 'Intro', video: 'ye9EhlfM4Sg' },
            { title: 'Talk About It', video: 'T9CHWOsGrx0' },
            { title: 'Genocide', video: '1YAjvTF9oyM' },
            { title: "It's All on Me", video: '7kTiQFj72l0' },
            { title: "All in a Day's Work", video: 'vTdrHc3gEfY' },
            { title: 'Darkside / Gone', video: '_60Y0aiV68o' },
            { title: 'Loose Cannons', video: '94Jfi-aRut0' },
            { title: 'Issues', video: '_FzhKF0eOm4' },
            { title: 'Deep Water', video: 'CBiZbAxuPU4' },
            { title: 'One Shot One Kill', video: 'Fiol0CYn6p8' },
            { title: 'Just Another Day', video: 'lkKGlfuKIto' },
            { title: 'For the Love of Money', video: 'ZbiMp6VqYYg' },
            { title: 'Satisfiction', video: 'uc6PSrIvC-w' },
            { title: 'Animals', video: 'BcUutVO-b-8' },
            { title: 'Medicine Man', video: '4LePtP2m_68' },
            { title: 'Talking to My Diary', video: 'Az_WXSsvIqM' },
        ],
    },
    {
        id: '2001',
        title: '2001',
        artist: 'Dr. Dre',
        year: '1999',
        cover: 'covers/2001.jpg',
        place: 'floor',
        tracks: [
            { title: 'Lolo (Intro)', video: '_nZZ3Y12m2A' },
            { title: 'The Watcher', video: 'erJQha5ur_U' },
            { title: 'Fuck You', video: '7EqnoEljHCw' },
            { title: 'Still D.R.E.', video: '_CL6n0FJZpk' },
            { title: "Big Ego's", video: 'XomLB_qIIDo' },
            { title: 'Xxplosive', video: 'WdlyIH2DX60' },
            { title: "What's the Difference", video: '-Ubyt7iWJ8Q' },
            { title: 'Bar One', video: 'fth1vgA068U' },
            { title: 'Light Speed', video: 'Ct32AqbvS_Y' },
            { title: 'Forgot About Dre', video: 'QFcv5Ma8u8k' },
            { title: 'The Next Episode', video: 'QZXc39hT8t4' },
            { title: "Let's Get High", video: 'zCqJAXlM1JI' },
            { title: 'Bitch Niggaz', video: 'JrBcYb3fH6E' },
            { title: 'The Car Bomb', video: '-tx8cT4p_FE' },
            { title: 'Murder Ink', video: 'JqOJ2-j3jz4' },
            { title: 'Ed-ucation', video: '_LfWooMs7Yk' },
            { title: 'Some L.A. Niggaz', video: 'y3cbJq5gs-M' },
            { title: 'Pause 4 Porno', video: '6nNAWG0j1Kw' },
            { title: 'Housewife', video: '6-DU8vBsKHk' },
            { title: 'Ackrite', video: '4S460AcbV6E' },
            { title: 'Bang Bang', video: 'nBYd1JeLV4U' },
            { title: 'The Message', video: 'iLcMgVDV60I' },
            { title: 'Outro', video: 'QsqP7xT7KW4' },
        ],
    },
    {
        id: 'gkmc',
        title: 'good kid, m.A.A.d city',
        artist: 'Kendrick Lamar',
        year: '2012',
        cover: 'covers/good-kid-maad-city.jpg',
        place: 'floor',
        tracks: [
            { title: "Sherane a.k.a Master Splinter's Daughter", video: 'REtSNvjxBXE' },
            { title: "Bitch, Don't Kill My Vibe", video: 'GF8aaTu2kg0' },
            { title: 'Backseat Freestyle', video: 'EZW7et3tPuQ' },
            { title: 'The Art of Peer Pressure', video: 't93uK0DKvEk' },
            { title: 'Money Trees', video: 'Iy-dJwHVX84' },
            { title: 'Poetic Justice', video: 'yyr2gEouEMM' },
            { title: 'good kid', video: 'raZ03s1rzd0' },
            { title: 'm.A.A.d city', video: 'mprkqDNUQb0' },
            { title: 'Swimming Pools (Drank) (Extended Version)', video: 'B5YNiCfWC3A' },
            { title: "Sing About Me, I'm Dying of Thirst", video: '75wmW7xjyog' },
            { title: 'Real', video: '71SsVUmT1ys' },
            { title: 'Compton', video: '9PovU-C2osU' },
        ],
    },
    {
        id: 'blueprint',
        title: 'The Blueprint',
        artist: 'JAY-Z',
        year: '2001',
        cover: 'covers/blueprint.jpg',
        place: 'wall',
        tracks: [
            { title: "The Ruler's Back", video: '35KDNqGEd7g' },
            { title: 'Takeover', video: '1YYO8O6pJps' },
            { title: 'Izzo (H.O.V.A.)', video: 'GRKmpn3SBdw' },
            { title: 'Girls, Girls, Girls', video: 'UCFAkD4EkYI' },
            { title: 'Jigga That N***a', video: 'UmeoTKXYhbQ' },
            { title: "U Don't Know", video: 'tzyW5f6jiSc' },
            { title: "Hola' Hovito", video: 'GWIBLwEEXFU' },
            { title: "Heart of the City (Ain't No Love)", video: 'n3GfToH_l4g' },
            { title: 'Never Change', video: 'pujwzWJbsuw' },
            { title: 'Song Cry', video: 'w5srnNrICJo' },
            { title: 'All I Need', video: 'Ns5lIW6QvFM' },
            { title: 'Renegade', video: 'k2dKodJL6kI' },
            { title: 'Blueprint (Momma Loves Me)', video: 'PU0El0sLWbg' },
            { title: 'Lyrical Exercise', video: 'kASqI_cuMhI' },
            { title: 'Girls, Girls, Girls, Pt. 2', video: 'JgObGcbtGuo' },
        ],
    },
    {
        id: 'its-been-awful',
        title: "IT'S BEEN AWFUL",
        artist: 'Isaiah Rashad',
        year: '2026',
        cover: 'covers/its-been-awful.jpg',
        place: 'wall',
        tracks: [
            { title: 'THE NEW SUBLIME', video: 'AxMsJt-Pmls' },
            { title: 'M.O.M.', video: 'WTDhp5qcKWk' },
            { title: 'SAME SH!T', video: 'z_8vbppalKo' },
            { title: 'BOY IN RED', video: 'U2F2Dq8QPIs' },
            { title: 'SUPAFICIAL', video: '2qg84rFPN9o' },
            { title: 'SCARED 2 LOOK DOWN', video: 'jN6jSkfMoVI' },
            { title: 'HAPPY HOUR', video: 'wGd4PzKYnT4' },
            { title: 'DO I LOOK HIGH?', video: 'CGoAZmirHb4' },
            { title: "AIN'T GIVIN' UP", video: '474k2StfWo8' },
            { title: 'GTKY', video: 'YACV36yahng' },
            { title: 'CAMERAS', video: 'bm0yOg6NC8g' },
            { title: 'ACT NORMAL', video: 'qBpoGC-Ae-8' },
            { title: '10 STATES AWAY', video: 'XzB_RD9Tnkg' },
            { title: 'NUTHIN 2 HIDE', video: '4VQ49YcUFyM' },
            { title: 'SUPERPWRS', video: 'uD7BpeAUQn0' },
            { title: '719 FREESTYLE', video: 'dfxlncQivjY' },
        ],
    },
    {
        id: 'damn',
        title: 'DAMN.',
        artist: 'Kendrick Lamar',
        year: '2017',
        cover: 'covers/damn.jpg',
        place: 'wall',
        tracks: [
            { title: 'BLOOD.', video: 'jvDZEoEdjzo' },
            { title: 'DNA.', video: 'NLZRYQMLDW4' },
            { title: 'YAH.', video: 'y-GWhui7obA' },
            { title: 'ELEMENT.', video: 'glaG64Ao7sM' },
            { title: 'FEEL.', video: 'LfjmxgjNP2g' },
            { title: 'LOYALTY.', video: 'Dlh-dzB2U4Y' },
            { title: 'PRIDE.', video: 'BBT2q7hsQRA' },
            { title: 'HUMBLE.', video: 'tvTRZJ-4EyI' },
            { title: 'LUST.', video: 'cA93cs-YReE' },
            { title: 'LOVE.', video: 'ox7RsX1Ee34' },
            { title: 'XXX.', video: 'jHKnssHObhM' },
            { title: 'FEAR.', video: 'nIb2-q3TqUU' },
            { title: 'GOD.', video: 'ZdBU440FFOg' },
            { title: 'DUCKWORTH.', video: 'VDhPjmPuD9k' },
        ],
    },
    {
        id: 'untitled-unmastered',
        title: 'untitled unmastered.',
        artist: 'Kendrick Lamar',
        year: '2016',
        cover: 'covers/untitled-unmastered.jpg',
        tracks: [
            { title: 'untitled 01 | 08.19.2014.', video: 'oIoZgIOgu3o' },
            { title: 'untitled 02 | 06.23.2014.', video: '_GghFQ8ryEU' },
            { title: 'untitled 03 | 05.28.2013.', video: 'o4M4qssoaWU' },
            { title: 'untitled 04 | 08.14.2014.', video: '82Cqp-kyrQs' },
            { title: 'untitled 05 | 09.21.2014.', video: 'inOEtUwSasc' },
            { title: 'untitled 06 | 06.30.2014.', video: 'fZ2pXyBBwsQ' },
            { title: 'untitled 07 | 2014 - 2016', video: 'kSWZJDBkN98' },
            { title: 'untitled 08 | 09.06.2014.', video: 'JXikcHwPolM' },
        ],
    },
];

/** The records filed in the rack under the turntable, in the order they were added. */
export const RACK_ALBUMS = ALBUMS.filter((a) => !a.place);

export const coverUrl = (album: Album) => `${import.meta.env.BASE_URL}${album.cover}`;

// The framed sleeves on the wall above the record shelf, left to right (Blender names; GLTFLoader turns
// spaces into underscores). `frame` is the modelled frame around each, which opens the same tracklist.
export const FRAMED_COVERS = [
    { mesh: 'Illmatic_framed_cover', frame: 'Framed_print_NAS', album: 'blueprint' },
    { mesh: 'All_Eyez_On_Me_framed_cover', frame: 'Framed_print_2PAC', album: 'its-been-awful' },
    { mesh: '36_Chambers_framed_cover', frame: 'Framed_print_WU-TANG', album: 'damn' },
];

/** The album a framed cover (or its frame) on the wall shows, if `name` is one of them. */
export const framedAlbumFor = (name: string) => FRAMED_COVERS.find((c) => c.mesh === name || c.frame === name)?.album;

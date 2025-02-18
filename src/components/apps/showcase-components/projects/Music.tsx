import React, { useState } from 'react';
// @ts-ignore
import MyOldTrack from '../../../../assets/audio/ItsMixvirus.wav';
import cd from '../../../../assets/icons/cd.png';
import MusicPlayer from '../../../general/MusicPlayer';
import BackArrow from "../../../general/BackArrow.tsx";

export interface MusicProjectsProps {}

const MusicProjects: React.FC<MusicProjectsProps> = (props) => {
    const [currentSong, setCurrentSong] = useState<string>('');

    return (
        <div className="site-page-content">
            <BackArrow/>
            <h1>Beats & Sound</h1>
            <h3>MixVirus Beats</h3>
            <br />
            <div className="text-block">
                <p>
                    Music has always been a core part of my life. Back in high school, I discovered FL Studio and started crafting my own beats, deeply influenced by old-school rap and classic hip-hop sounds.
                </p>
                <br />
                <p>
                    Under the name MixVirus Beats, I dedicated countless hours to creating instrumentals that captured the raw, rhythmic energy of hip-hop. Producing beats became a creative escape, a way to experiment with sounds and techniques that resonated with my early influences.
                </p>
                <br />
                <p>
                    Although I never pursued music production as a full-time endeavor, I still have a deep love for the process. Here are a few of my past projects—tracks that reflect my evolution as a beatmaker and my passion for hip-hop production.
                </p>
            </div>
            
            <h2>Early Hip-Hop Beats</h2>
            <br />
            <p>
                My first productions were heavily inspired by golden-era hip-hop—gritty drums, soulful samples, and deep bass grooves. I spent hours chopping samples, layering kicks and snares, and experimenting with different arrangements.
            </p>
            <br />
            <MusicPlayer
                src={MyOldTrack}
                title="Raw Vibes"
                subtitle="MixVirus Beats - 2015"
                currentSong={currentSong}
                setCurrentSong={setCurrentSong}
            />
            <br />
            <p>
                This track represents my early style—boom-bap drums with a soulful touch. It was one of the first beats where I felt like I truly captured the sound I was aiming for.
            </p>
            <br />
            
            <h2>Experimenting with Modern Sounds</h2>
            <br />
            <p>
                As I continued developing my craft, I began exploring more contemporary styles—mixing elements of trap, lo-fi, and electronic influences into my beats.
            </p>
            <br />
            <MusicPlayer
                src={MyOldTrack}
                title="Elevate"
                subtitle="MixVirus Beats - 2018"
                currentSong={currentSong}
                setCurrentSong={setCurrentSong}
            />
            <br />
            <p>
                This beat showcases a transition from old-school hip-hop to a more modern, ambient sound, featuring atmospheric pads and hard-hitting 808s.
            </p>
            <br />
            
            <h2>What's Next for MixVirus Beats?</h2>
            <br />
            <p>
                While I no longer produce music as often as I used to, the passion remains. One day, I might revisit some unfinished projects or even release a collection of my best beats.
            </p>
            <br />
            <p>
                I hope you enjoy listening to these tracks as much as I enjoyed making them. Thanks for stopping by and checking out my music journey!
            </p>
            <br />
        </div>
    );
};

export default MusicProjects;

import React from 'react';
import { Link } from 'react-router-dom';
import CvDownload from './CvDownload';
import me from '../../../assets/pictures/curme.jpg'
export interface AboutProps { }

const About: React.FC<AboutProps> = () => {
    return (
        <div className="site-page-content">
            <h1 style={{ marginLeft: -16 }}>Hello!</h1>
            <h3>I'm Konstantinos</h3>
            <br />
            <div className="text-block">
                <p>
                    I'm a passionate software developer currently working as a Freelancer! I graduated in 2018 from Aristotle University of Thessaloniki with a Integrated Master's degree in Civil & Structural Engineering. In the next year I also finished a MSc. in Structural and Earthquake Engineering at Aristotle University of Thessaloniki.
                </p>
                <br />
                <p>
                    I appreciate you taking the time to explore my portfolio. It was a joy to create, and I hope you find it both engaging and informative. If you have any questions or feedback, please don't hesitate to reach out via the <Link to="/contact">contact form</Link> or email me at <a href="mailto:k.mixios@gmail.com">k.mixios@gmail.com</a>.
                </p>
            </div>
            <CvDownload />
            <div className="text-block">
                <h3>About Me</h3>
                <br />
                <p>
                    My journey into the world of technology began at a young age, fueled by an innate curiosity for how things work. I was always fascinated with building and creating, which eventually led me to discover programming. After moving from [Your Hometown] to [New Location], I continued to nurture this passion through various projects and educational pursuits.
                </p>
                <br />
                <p>
                    During high school, I honed my skills by working on various web and software development projects. My love for technology only grew as I collaborated with friends and mentors, taking on challenges that pushed my understanding and creativity. Some of these projects can be viewed on my <Link to="/projects/software">Software Projects</Link> page.
                </p>
                <br />
                <br />
                <div style={{}}>
                    <div
                        style={{
                            flex: 1,
                            textAlign: 'justify',
                            alignSelf: 'center',
                            flexDirection: 'column',
                        }}
                    >
                        <h3>My Hobbies</h3>
                        <br />
                        <p>
                            When I'm not coding, I indulge in a variety of hobbies. I'm passionate about <Link to="/projects/music">Music Production</Link> and <Link to="/projects/art">Digital Art</Link>, which allow me to express my creativity in different ways. I also enjoy staying active through workouts, experimenting with new recipes in the kitchen, and, of course, playing video games.
                        </p>
                        <br />
                        <p>
                            During my college years, I was an active member of [Your Fraternity/Club], where I held multiple leadership positions and formed lifelong friendships. This community played a pivotal role in shaping my college experience.
                        </p>
                    </div>
                    <div style={styles.verticalImage}>
                        <img src={me} style={styles.image} alt="Current me" />
                        <p>
                            <sub>
                                <b>Figure 2:</b> A recent photo, [Month, Year]
                            </sub>
                        </p>
                    </div>
                </div>
                <br />
                <br />
                <p>
                    Thanks for taking the time to learn more about me! I hope you enjoy exploring the rest of my portfolio. If you stumble upon the hidden easter egg, let me know on X (aka Twitter) at <a rel="noreferrer" target="_blank" href="https://x.com/iammix95">@iammix95</a>. Have fun!
                </p>
                <br />
                <p>
                    If you have any questions or would like to connect, feel free to reach out through the <Link to="/contact">contact page</Link> or email me at <a href="mailto:k.mixios@gmail.com">k.mixios@gmail.com</a>.
                </p>
            </div>
        </div>
    );
};


interface StyleSheetCSS {
    [key: string]: React.CSSProperties;
}

const styles: StyleSheetCSS = {
    contentHeader: {
        marginBottom: 16,
        fontSize: 48,
    },
    image: {
        height: 'auto',
        width: '100%',
        borderRadius: '50px',
        overflow: 'hidden'
    },
    topImage: {
        height: 'auto',
        width: '100%',
        marginBottom: 32,
    },
    verticalImage: {
        alignSelf: 'center',
        marginLeft: 32,
        flex: 0.8,
        alignItems: 'center',
        textAlign: 'center',
        flexDirection: 'column',
    },
};

export default About;
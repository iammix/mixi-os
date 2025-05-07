import React from 'react';
import { Link } from 'react-router-dom';
// import CvDownload from './CvDownload';
import me from '../../../assets/pictures/curme.jpg';
import BackArrow from "../../general/BackArrow.tsx";

export interface AboutProps {}

const About: React.FC<AboutProps> = () => {
    return (
        <div className="site-page-content">
            <BackArrow />
            <h1 style={{ marginLeft: -16 }}>Hello!</h1>
            <h3>I'm Konstantinos</h3>
            <br />
            <div className="text-block">
                <p>
                    I'm a software engineer with a strong passion for technology, solving real-life problems, and data-driven solutions.
                    I hold an Integrated Master's degree in Civil & Structural Engineering from Aristotle University of Thessaloniki (2018) and a Master's in Structural and Earthquake Engineering from the same institution (2019).
                </p>
                <br />
                <p>
                    Over the years, I've bridged the gap between engineering and technology, developing custom software solutions, compuntational tools, data analysis tools, and digital applications tailored to the needs of the product owners. My expertise spans computational analysis, backend system designing, and software development—fields where precision and innovation go hand in hand.
                </p>
                <br />
                <p>
                    I created this portfolio to share my work, insights, and projects. I hope you find it both engaging and informative! If you have any questions or just want to connect, feel free to reach out via the <Link to="/contact">contact form</Link> or email me at <a href="mailto:k.mixios@gmail.com">k.mixios@gmail.com</a>.
                </p>
            </div>
            {/* <CvDownload /> */}
            <div className="text-block">
                <h3>About Me</h3>
                <br />
                <p>
                    My journey into software developing started with my fascination for problem-solving and technology. During my studies, I worked on several research projects involving computational analysis, numerical modeling, and real-time monitoring systems.
                </p>
                <br />
                <p>
                    As I delved deeper into these topics, I realized the power of coding in automating complex tasks, analyzing massive datasets, and improving decision-making processes in engineering. This led me to develop custom Python libraries.
                </p>
                <br />
                <p>
                    I also have a keen interest in entrepreneurship and product development, with a focus on building scalable software solutions.
                </p>
                <br />
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div
                        style={{
                            flex: 1,
                            textAlign: 'justify',
                            alignSelf: 'center',
                            flexDirection: 'column',
                        }}
                    >
                        <h3>Beyond Work</h3>
                        <br />
                        <p>
                            When I am not working on engineering or software projects, you can find me rowing, training for triathlon, and experimenting with fitness tracking. I'm deeply interested in human performance, recovery metrics, and wearable technology, which has led me to develop an App for monitoring training load, HRV, and recovery.
                        </p>
                        <br />
                        <p>
                            I'm also passionate about drawing, music, cooking and traveling. These activities provide balance and inspiration, often influencing my approach to both problem-solving and creativity in tech.
                        </p>
                    </div>
                    <div style={styles.verticalImage}>
                        <img src={me} style={styles.image} alt="Current me" />
                        <p>
                            <sub>
                                <b>Figure 1:</b> Me @ Mount Olympus, Greece 2021
                            </sub>
                        </p>
                    </div>
                </div>
                <br />
                <p>
                    Thanks for taking the time to learn more about me!
                    If you stumble upon the hidden easter egg, let me know on X (Twitter) at <a rel="noreferrer" target="_blank" href="https://x.com/iammix95">@iammix95</a>.  
                    Hope you enjoy browsing through my projects!
                </p>
                <br />
                <p>
                    For collaborations, inquiries, or just a casual chat, you can reach me via the <Link to="/contact">contact page</Link> or email me at <a href="mailto:k.mixios@gmail.com">k.mixios@gmail.com</a>.
                </p>
            </div>
        </div>
    );
};

interface StyleSheetCSS {
    [key: string]: React.CSSProperties;
}

const styles: StyleSheetCSS = {
    image: {
        height: 'auto',
        width: '100%',
        borderRadius: '50px',
        overflow: 'hidden'
    },
    verticalImage: {
        alignSelf: 'center',
        marginLeft: 32,
        flex: 0.8,
        alignItems: 'center',
        textAlign: 'center',
        flexDirection: 'column',
    },
}

export default About;
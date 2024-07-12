import React from 'react';
import { Link } from 'react-router-dom';
import CvDownload from './CvDownload';
import me from '../../../assets/pictures/curme.jpg'

interface AboutProps {}

const About: React.FC<AboutProps> = (props) => {
    return (
        <div className='site-page-content'>
            <h1 style={{marginLeft: -16}}>Welcome</h1>
            <h3>I'm Konstantinos Mixios</h3>
            <br/>
            <div className='text-block'>
                <p>

                    I'm a Software Engineer, currently working as a Freelancer in Thessaloniki, Greece.

                </p>
                <br/>
                <p>
                    This i my p
                </p>
            </div>
            <CvDownload/>
            <div className='text-block'>
                <h3>About Me</h3>
                <br/>
                <p>
                    {/* TODO: Write a small paragraph about me */}
                </p>
                <br/>
                <p>
                    I started programming more seriously in high school,
                    initially learning to manipulate computers utilizing bash files.
                </p>
                <br/>
                <br/>
                <div style={{}}>
                    <div 
                        style={{
                            flex:1,
                            textAlign:'justify',
                            alignSelf: 'center',
                            flexDirection: 'column'
                        }}
                    >
                        <h3> In my free time...</h3>
                        <br/>
                        <p>
                            Beyond software engineer career, I have some hobbies and

                        </p>
                    </div>
                    <div style={styles.verticalImage}>
                        <img src={me} style={styles.image}/>
                    </div>

                </div>
            </div>

        </div>

    )
};
const styles: StyleSheetCSS = {
    contentHeader: {
        marginBottom: 16,
        fontSize: 48,
    },
    image: {
        height: 'auto',
        width: '100%',
    },
    topImage: {
        height: 'auto',
        width: '100%',
        marginBottom: 32,
    },
    verticalImage: {
        alignSelf: 'center',
        // width: '80%',
        marginLeft: 32,
        flex: 0.8,

        alignItems: 'center',
        // marginBottom: 32,
        textAlign: 'center',
        flexDirection: 'column',
    },
};




export default About;

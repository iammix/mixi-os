import React from 'react';
import { Link } from 'react-router-dom';
import CvDownload from './CvDownload';

interface AboutPros {}

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
            </div>

        </div>

    )
}
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

import React, { useEffect, useState } from 'react';
//import colors from '../../../constants/colors';
import xIcon from '../../../assets/pictures/xIcon.png';
import githubIcon from '../../../assets/pictures/github.png';
import linkedInIcon from '../../../assets/pictures/linkedin.png';
import CvDownload from "./CvDownload.tsx";
import BackArrow from '../../general/BackArrow.tsx';

interface ContactProps {}

const validateEmail = (email: string) => {
    const re =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
};

interface SocialBoxProps {
    icon: string;
    link: string;
}

const SocialBox: React.FC<SocialBoxProps> = (props) => {
    return (
        <a rel='noreferrer' target='_blank' href={props.link}>
            <div className='big-button-container' style={styles.social}>
                <img src={props.icon} alt="" style={styles.socialImage}/>
            </div>
        </a>
    );
};

const Contact: React.FC<ContactProps> = () => {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [isFormValid, setIsFormValid] = useState(false);
    const [isLoading, ] = useState(false);
    const [formMessage, setFormMessage] = useState('');
    const [, setFormMessageColor] = useState('');

    useEffect(()=>{
        if (validateEmail(email) && name.length > 0 && message.length > 0) {
            setIsFormValid(true);
        } else {
            setIsFormValid(false);
        }
    }, [email, name, message]);


    useEffect(()=>{
        if (formMessage.length > 0) {
            setTimeout(()=> {
                setFormMessage('');
                setFormMessageColor('');
            }, 4000);
        }
    }, [formMessage]);

    return (
        <div className='site-page-content'>
            <BackArrow/>
            <br/>
            <br/>
            <br/>
            <br/>
            <div style={styles.header}>
                <h1>Contact</h1>
                <div style={styles.socials}>
                    <SocialBox
                        icon={githubIcon}
                        link={'https://www.github.com/iammix'}
                    />
                    <SocialBox
                        icon={linkedInIcon}
                        link={'https://www.linkedin.com/in/konstantinosmixios'}
                    />
                    <SocialBox
                        // TODO: Create a more blurry X icon
                        icon={xIcon}
                        link={'https://www.x.com/iammix95'}
                    />
                </div>
            </div>
            <div className='text-block'>
                <p>
                    I'm excited to connect with you! Whether you have a question, a project idea,
                    or just want to say hello, feel free to reach out.
                    Please fill out the form below, and I'll get back to you as soon as possible.
                </p>
                <br />
                <p>
                    <b>Email: </b>
                    <a href='mailto:contact@mixiosk.com'>contact@mixiosk.com</a>
                </p>
                <div style={styles.form}>
                    <label>
                        <p>
                            {!name && <span style={styles.star}>*</span>}
                            <b>Name:</b>
                        </p>
                    </label>
                    <input
                        style={styles.formItem}
                        type='text'
                        name='name'
                        placeholder='Name'
                        value={name}
                        onChange={(e)=>setName(e.target.value)}
                    />
                    <label>
                    <p>
                        {!validateEmail(email) && (<span style={styles.star}>*</span>)}
                        <b>Email:</b>
                    </p>
                    </label>
                    <input
                        style={styles.formItem}
                        type='email'
                        name='email'
                        placeholder='Email'
                        value={email}
                        onChange={(e)=>setEmail(e.target.value)}
                    />
                    <label>
                        <p>
                            {!message && <span style={styles.star}>*</span>}
                            <b>Message:</b>
                        </p>
                    </label>
                    <textarea
                        name='message'
                        placeholder='Message'
                        style={styles.formItem}
                        value={message}
                        onChange={(e)=>setMessage(e.target.value)}
                    />
                    <div>
                        {/*TODO: add functionality to the submit button */}
                        <button
                            className='site-button'
                            style={styles.button}
                            type='submit'
                            disabled={!isFormValid || isLoading}
                        >
                            {!isLoading ? (
                                'Send Message'
                            ) : (
                                <p className='loading'>Sending</p>
                            )}
                        </button>
                        {/*<div style={styles.formInfo}>*/}
                        {/*    <p style={Object.assign({}, {color: formMessageColor})}>*/}
                        {/*        <b>*/}
                        {/*            <sub>*/}
                        {/*                {formMessage ? `${formMessage}`: 'All messages get forwarded to my personal email'}*/}
                        {/*            </sub>*/}
                        {/*        </b>*/}
                        {/*    </p>*/}
                        {/*    <p>*/}
                        {/*        <sub>*/}
                        {/*            {!isFormValid ? (*/}
                        {/*                <span>*/}
                        {/*                    <b style={styles.star}>*</b>*/}
                        {/*                </span>*/}
                        {/*            ) : (*/}
                        {/*                '\xa0'*/}
                        {/*            )}*/}
                        {/*        </sub>*/}
                        {/*    </p>*/}
                        {/*</div>*/}
                    </div>
                </div>
            </div>
            <CvDownload altText='Need a copy of me CV?!'/>
        </div>
    );

}

interface StyleSheetCSS {
    [key: string]: React.CSSProperties;
}

const styles: StyleSheetCSS = {
    form: {
        flexDirection: 'column',
        marginTop: 32,
    },
    formItem: {
        marginTop: 4,
        marginBottom: 16,
    },
    socialImage: {
        width: 36,
        height: 36,
    },
    buttons: {
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    formInfo: {
        textAlign: 'right',

        flexDirection: 'column',
        alignItems: 'flex-end',
        paddingLeft: 24,
    },
    star: {
        paddingRight: 4,
        color: 'red',
    },
    button: {
        minWidth: 184,
        height: 32,
    },
    header: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    socials: {
        marginBottom: 16,
        justifyContent: 'flex-end',
    },
    social: {
        width: 4,
        height: 4,
        // borderRadius: 1000,

        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
};

export default Contact;




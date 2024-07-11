import React, { useEffect, useState, useCallback } from 'react';
import colors from '../../../constants/colors';
import twitterIcon from '../../../assets/pictures/twitter.png';
import githubIcon from '../../../assets/pictures/github.png';
import linkedInIcon from '../../../assets/pictures/linkedin.png';

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

const Contact: React.FC<ContactProps> = (props) => {
    const[company, setCompany] = useState('');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [isFormValid, setIsFormValid] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formMessage, setFormMessage] = useState(false);
    const [formMessageColor, setFormMessageColor] = useState('');

    useEffect(()=>{
        if (validateEmail(email) && name.length > 0 && message.length > 0) {
            setIsFormValid(true);
        } else {
            setIsFormValid(false);
        }
    }, [email, name, message]);

    async function submitForm() {
        if (!isFormValid) {
            setFormMessage('Form is not VALID, please try again!')
            setFormMessageColor('red');
            return;
        }
        // TODO: implement API Calls

    }

    useEffect(()=>{
        if (formMessage.lenght > 0) {
            setTimeout(()=> {
                setFormMessage('');
                setFormMessageColor('');
            }, 4000);
        }
    }, [formMessage]);

    return (
        <div className='site-page-content'>
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
                        icon={twitterIcon}
                        link={'https://www.x.com/iammix95'}
                    />
                </div>
            </div>
            <div>
                <p>
                    I am currently working on different projects as a Software Engineer. Specifically working as a
                    back-end engineer.
                </p>
            </div>
        </div>
    )

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




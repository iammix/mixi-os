import React, { useEffect, useState, useCallback } from 'react';
import colors from '../../../constants/colors';
import twitterIcon from '../../../assets/pictures/twitter.png';
import githubIcon from '../../../assets/pictures/github.png';
import linkedInIcon from '../../../assets/pictures/linkedin.png';

export interface ContactProps {}

const validateEmail = (email: string) => {
    const re =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
};

interface SocialBoxProps {
    icon: string;
    link: string;
}

const SocialBox: React.FC<SocialBoxProps> = ({link, icon }) => {
    return (
        <a></a>
    )
}



import React, {useState} from 'react';
import BackArrow from '../../../general/BackArrow';

export interface HalfMeetingProps {}

const HalfMeeting: React.FC<HalfMeetingProps> =(props) => {
    return (
    <iframe
                height={'100%'}
                width={'100%'}
                src={'https://mixios-terminal.vercel.app/'}/>
    );
};

export default HalfMeeting;
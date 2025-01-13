import React from 'react';
import BackArrow from '../../../general/BackArrow.tsx';

export interface MeetingMinuteProps {
}

const ShortMeeting: React.FC<MeetingMinuteProps> = () => {
    return (
        <div className='site-page-content'>
            <BackArrow/>
            <iframe
                style={styles.borderStyle}
                src="https://calendar.google.com/calendar/appointments/schedules/AcZssZ2Udegcp13zo-2MIg14Bwolj_0acirZ0EXAfCvONfEKBWfGAlrfiGOhqGzR5JFVBAXOq3oNTH12?gv=true"
                ></iframe>
        </div>
    )
}
interface StyleSheetCSS {
    [key: string]: React.CSSProperties;
}

const styles: StyleSheetCSS = {

    borderStyle: {
        border: '0',
        width: '100%',
        height: '100%',
    }
}
export default ShortMeeting;


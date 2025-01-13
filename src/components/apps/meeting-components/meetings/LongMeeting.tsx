import React from 'react';
import BackArrow from '../../../general/BackArrow.tsx';

export interface MeetingMinuteProps {
}

const LongMeeting: React.FC<MeetingMinuteProps> = () => {
    return (
        <div className='site-page-content'>
            <BackArrow/>
            <iframe
                src="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0x7g8Iu4MzrMwORJFB5OGU2Y4uubm8Zd8HGtj0cs0tmBmUqUqT001POSRd1sONAmFS8XbLl3j_?gv=true"
                style={styles.borderStyle}></iframe>
        </div>
    )
}

interface StyleSheetCSS {
    [key: string]: React.CSSProperties;
}

const styles: StyleSheetCSS = {

    borderStyle: {
        border: '0',
        width:'100%',
        height: '100%',
    }
}
export default LongMeeting;


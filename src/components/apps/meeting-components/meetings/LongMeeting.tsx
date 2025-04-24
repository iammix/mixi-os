import React from 'react';
import BackArrow from '../../../general/BackArrow.tsx';

export interface MeetingMinuteProps {
}

const LongMeeting: React.FC<MeetingMinuteProps> = () => {
    return (
        <div className='site-page-content'>
            <BackArrow/>
            <iframe
                src="https://calendar.google.com/calendar/appointments/schedules/AcZssZ2ZpMtEVtM9JqipaZZ9XnRUSG1NibvGjGQFUeXGbCxasF2ghC1Ub43UzAF0o1ntdqrkI2TqNAxT?gv=true"
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


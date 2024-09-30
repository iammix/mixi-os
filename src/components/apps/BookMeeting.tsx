import React from 'react';
import useInitialWindowSize from "../../hooks/useInitialWindowSize.tsx";
import Window from '../os/Window.tsx';

export interface BookMeetingProps extends WindowAppProps { }

const BookMeeting: React.FC<BookMeetingProps> = (props) => {
    const { initWidth, initHeight } = useInitialWindowSize({ margin: 100 });

    return (
        <Window
            top={24}
            left={56}
            width={initWidth}
            height={initHeight}
            windowTitle="Konstantinos Mixios - About me"
            windowBarIcon="windowExplorerIcon"
            closeWindow={props.onClose}
            onInteract={props.onInteract}
            minimizeWindow={props.onMinimize}
            bottomLeftText={''}>
            <div className='site-page'>
                <iframe
                src={'http://localhost:3000/'}/>
            </div>
        </Window>
    );
};

export default BookMeeting;

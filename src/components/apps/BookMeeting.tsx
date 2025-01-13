import React, {useState} from "react";
import useInitialWindowSize from "../../hooks/useInitialWindowSize.tsx";
import Window, {WindowProps} from "../os/Window.tsx";
import calendarpx from "../../assets/icons/calendar-px.gif";
import MeetingBox from "./meeting-components/MeetingBox.tsx";
import MeetingMinute from "./meeting-components/meetings/ShortMeeting.tsx";
import {Route, Routes} from "react-router-dom";
import MeetingHome from "./meeting-components/MeetingHome.tsx";
import ShortMeeting from "./meeting-components/meetings/ShortMeeting.tsx";
import LongMeeting from "./meeting-components/meetings/LongMeeting.tsx";

export interface BookMeetingProps extends WindowProps {
}

const BookMeeting: React.FC<BookMeetingProps> = (props) => {
    const {initWidth, initHeight} = useInitialWindowSize({margin: 100});
    return (
        <Window
            top={24}
            left={56}
            width={initWidth}
            height={initHeight}
            windowTitle="Book meeting"
            windowBarIcon="windowExplorerIcon"
            closeWindow={props.onClose}
            onInteract={props.onInteract}
            minimizeWindow={props.onMinimize}
            bottomLeftText={""}
        >
            <Routes>
                <Route path="/" element={<MeetingHome/>}/>
                <Route path="/meeting/meeting30" element={<ShortMeeting/>}/>
                <Route path="/meeting/meeting60" element={<LongMeeting/>}/>

            </Routes>
        </Window>
    );
};


export default BookMeeting;

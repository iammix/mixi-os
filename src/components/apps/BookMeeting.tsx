import React from 'react';
import useInitialWindowSize from "../../hooks/useInitialWindowSize.tsx";
import Window from '../os/Window.tsx';
import BackArrow from "../general/BackArrow.tsx";
import ProjectBox from "./showcase-components/ProjectBox.tsx";
import music from "../../assets/pictures/projects/music.gif";
import calendar from "../../assets/icons/calendar.gif"
import calendarpx from "../../assets/icons/calendar-px.gif"
import MeetingBox from './showcase-components/MeetingBox.tsx';
import { Routes, Route, useNavigate } from "react-router-dom";
import HalfMeeting from './showcase-components/meetings/HalfMeet.tsx';

export interface BookMeetingProps extends WindowAppProps {
}

const BookMeeting: React.FC<BookMeetingProps> = (props) => {
    const navigate = useNavigate();
    const { initWidth, initHeight } = useInitialWindowSize({ margin: 100 });
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
            bottomLeftText={''}>
            <div className="site-page-content">
                <h1>meeting type</h1>
                <h3>choose meeting time</h3>
                <br/>
                <div style={styles.projectLinksContainer}>
                    <MeetingBox
                        icon={calendarpx}
                        iconStyle={styles.computerIcon}
                        title="30 minutes meeting"
                        route='meeting30'
                        navigate={navigate}
                    />
                    <MeetingBox
                        icon={calendarpx}
                        iconStyle={styles.computerIcon}
                        title="60 minutes meeting"
                        route="meeting60"
                        navigate={navigate}
                    />
                </div>
                <Routes>
                    <Route path="/meetings/meeting30" element={<HalfMeeting />} />
                    <Route path="/meetings/meeting60" element={<HalfMeeting />} />
                </Routes>
            </div>
        </Window>
    );
};

interface StyleSheetCSS {
    [key: string]: React.CSSProperties;
}

const styles: StyleSheetCSS = {
    projectLinksContainer: {
        flexDirection: "column",
        width: "100%",
        display: "flex",
        flex: 1,
    },
    projectLink: {
        marginBottom: 24,
        cursor: "pointer",
        width: "100%",
        boxSizing: "border-box",

        alignItems: "center",
        justifyContent: "space-between",
    },
    projectText: {
        justifyContent: "center",
        flexDirection: "column",
    },
    projectLinkImage: {
        width: 48,
        // height: 48,
        marginRight: 38,
    },
    projectLinkLeft: {
        marginLeft: 16,
        alignItems: "center",
    },
    computerIcon: {
        width: 56,
        height: 56,
    },
    musicIcon: {
        width: 48,
        height: 48,
    },
    arrowIcon: {
        width: 48,
        height: 48,
    },
    artIcon: {
        width: 21 * 2,
        height: 37 * 2,
    },
};

export default BookMeeting;

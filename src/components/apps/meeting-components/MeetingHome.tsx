import React from "react";
import calendarpx from "../../../assets/icons/calendar-px.gif";
import MeetingBox from "./MeetingBox.tsx";
import {useNavigate} from "react-router-dom";
import {WindowProps} from "../../os/Window.tsx";

export interface BookMeetingProps{}

const BookMeeting: React.FC<BookMeetingProps> = (props) => {

    const navigate = useNavigate();

    return (

        <div className="site-page-content">
            <h1>Meeting Type</h1>
            <h3>Choose Meeting Time</h3>
            <br/>
            <div style={styles.projectLinksContainer}>
                <MeetingBox
                    icon={calendarpx}
                    iconStyle={styles.computerIcon}
                    title="30 minutes meeting"
                    route="meeting30"
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
        </div>
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
    computerIcon: {
        width: 56,
        height: 56,
    },
};

export default BookMeeting;

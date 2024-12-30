import React from 'react';
import useInitialWindowSize from "../../hooks/useInitialWindowSize.tsx";
import Window from '../os/Window.tsx';
import {useNavigate} from "react-router-dom";
import BackArrow from "../general/BackArrow.tsx";
import ProjectBox from "./showcase-components/ProjectBox.tsx";
import music from "../../assets/pictures/projects/music.gif";

export interface BookMeetingProps extends WindowAppProps {
}

const BookMeeting: React.FC<BookMeetingProps> = () => {
    const navigate = useNavigate();
    // const { initWidth, initHeight } = useInitialWindowSize({ margin: 100 });
    return (
        <div className="site-page-content">
            <BackArrow/>
            <h3>meeting type</h3>
            <br/>
            <div style={styles.projectLinksContainer}>
                <ProjectBox
                    icon={music}
                    iconStyle={styles.computerIcon}
                    title="30 minutes meeting"
                    subtitle=""
                    route=''
                    navigate={navigate}
                />
                <ProjectBox
                    icon={music}
                    iconStyle={styles.computerIcon}
                    title="60 minutes meeting"
                    subtitle=""
                    route=""
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

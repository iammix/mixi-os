import React from "react";
import { useNavigate } from "react-router-dom";
import ProjectBox from "./ProjectBox";
import music from "../../../assets/pictures/projects/music.gif";
import software from "../../../assets/pictures/projects/software.gif"
import BackArrow from "../../general/BackArrow.tsx";

const Projects: React.FC = () => {
    const navigate = useNavigate(); // Get navigate from the router context

    return (
        <div className="site-page-content">
            <BackArrow/>
            <h1>Projects</h1>
            <h3>& Hobbies</h3>
            <br />
            <p>
                Click on one of the areas below to check out some of my favorite
                projects I've done in that field.
            </p>
            <br />
            <div style={styles.projectLinksContainer}>
                <ProjectBox
                    icon={music}
                    iconStyle={styles.musicIcon}
                    title="Music"
                    subtitle="MixVirus Beats"
                    route="music"
                    navigate={navigate}
                />
                <ProjectBox
                    icon={software}
                    iconStyle={styles.computerIcon}
                    title="Software"
                    subtitle="Side Projects"
                    route='software'
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

export default Projects;

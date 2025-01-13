import React from 'react';

interface MeetingBoxProps {
    icon: string;
    title: string;
    route: string;
    iconStyle: React.CSSProperties;
    navigate: (path: string) => void;
}

const MeetingBox: React.FC<MeetingBoxProps> = ({
    icon,
    title,
    route,
    iconStyle,
    navigate
}) => {
    const handleClick = () => {
        navigate(`/meeting/${route}`);
    };
    return (
        <div
            onMouseDown={handleClick}
            className="big-button-container"
            style={styles.meetingLink}
        >
            <div style={styles.meetingLinkLeft}>
                <img src={icon} style={{ ...styles.meetingLinkImage, ...iconStyle }} alt=""/>
                <div style={styles.meetingText}>
                    <h1 style={{ fontSize: 48 }}>{title}</h1>
                </div>
            </div>
            <div style={styles.meetingLinkRight}></div>
        </div>
    );
};
export default MeetingBox;

interface StyleSheetCSS {
    [key: string]: React.CSSProperties;
}



const styles: StyleSheetCSS = {
    meetingLinksContainer: {
        flexDirection: 'column',
        width: '100%',
        display: 'flex',
        flex: 1,
    },
    meetingLink: {
        marginBottom: 24,
        cursor: 'pointer',
        width: '100%',
        boxSizing: 'border-box',

        alignItems: 'center',
        justifyContent: 'space-between',
    },
    meetingText: {
        justifyContent: 'center',
        flexDirection: 'column',
    },
    meetingLinkImage: {
        width: 48,
        // height: 48,
        marginRight: 38,
    },
    meetingLinkLeft: {
        marginLeft: 16,
        alignItems: 'center',
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
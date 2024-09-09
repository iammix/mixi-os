import React from 'react';

interface ProjectBoxProps {
  icon: string;
  title: string;
  subtitle: string;
  route: string;
  iconStyle: React.CSSProperties;
  navigate: (path: string) => void; // Pass navigation function as prop
}

const ProjectBox: React.FC<ProjectBoxProps> = ({
  icon,
  title,
  subtitle,
  route,
  iconStyle,
  navigate, // Receive navigate prop
}) => {
  const handleClick = () => {
    navigate(`/projects/${route}`);
  };

  return (
    <div
      onMouseDown={handleClick}
      className="big-button-container"
      style={styles.projectLink}
    >
      <div style={styles.projectLinkLeft}>
        <img src={icon} style={{...styles.projectLinkImage, ...iconStyle }} alt="" />
        <div style={styles.projectText}>
          <h1 style={{ fontSize: 48 }}>{title}</h1>
          <h3>{subtitle}</h3>
        </div>
      </div>
      <div style={styles.projectLinkRight}></div>
    </div>
  );
};

export default ProjectBox;

interface StyleSheetCSS {
    [key: string]: React.CSSProperties;
}



const styles: StyleSheetCSS = {
    projectLinksContainer: {
        flexDirection: 'column',
        width: '100%',
        display: 'flex',
        flex: 1,
    },
    projectLink: {
        marginBottom: 24,
        cursor: 'pointer',
        width: '100%',
        boxSizing: 'border-box',

        alignItems: 'center',
        justifyContent: 'space-between',
    },
    projectText: {
        justifyContent: 'center',
        flexDirection: 'column',
    },
    projectLinkImage: {
        width: 48,
        // height: 48,
        marginRight: 38,
    },
    projectLinkLeft: {
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
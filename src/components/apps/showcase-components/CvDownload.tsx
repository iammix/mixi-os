import React from 'react';
import printer from '../../../assets/cv/printer.gif';
import CV from '../../../assets/cv/CV-Mixios.pdf';

export interface CvDownloadProps {
    altText?:string;
}

const CvDownload: React.FC<CvDownloadProps> = ({ altText }) => {
    return (
        <div style={styles.cvContainer}>
            <img style={styles.cvPrinter} src={printer}/>
            <div style={styles.cvContainerText}>
                <h3>{altText ? altText: 'Looking for my CV?'}</h3>
                <a rel="noreferrer" target='_blank' href={CV}>
                    <p>Click here to download CV!</p>
                </a>
            </div>
        </div>

    )
};

interface StyleSheetCSS {
    [key: string]: React.CSSProperties;
}


const styles: StyleSheetCSS = {
    cvContainer: {
        backgroundColor: 'white',
        padding: 12,
        boxSizing: 'border-box',
        border: '2px solid black',
        borderLeftWidth: 0,
        borderRightWidth: 0,
        width: '100%',
        alignItems: 'center',
    },
    cvContainerText: {
        flexDirection: 'column',
    },
    cvPrinter: {
        width: 56,
        height: 48,
        paddingRight: 24,
    },
};

export default CvDownload;
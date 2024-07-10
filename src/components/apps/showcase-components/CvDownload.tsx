import React from 'react';
import printer from '../../../assets/cv/printer.gif';
import CV from '../../../assets/cv/CV-Mixios.pdf';

export interface CvDownloadProps {
    altText?:string;
}

const CvDownload: React.FC<CvDownloadProps> = ({ altText }) => {
    return (
        <div>
            <img src={printer}/>
            <div>
                <h3>{altText ? altText: 'Looking for my CV?'}</h3>
                <a rel="noreferrer" target='_blank' href={CV}>
                    <p>Click here to download CV!</p>
                </a>
            </div>
        </div>

    )
};


export default CvDownload;
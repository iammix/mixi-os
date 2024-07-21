import React from 'react';
import { useNavigate } from 'react-router-dom';
import arrowIcon from '../../assets/pictures/arrowIcon.png'
import { useAnimate } from 'framer-motion';


const BackArrow: React.FC = ()=> {
    const arrowNavigate = useNavigate();

    return (
        <div style={styles.arrowContainer} onClick={()=> arrowNavigate('/')}>
            <img src={arrowIcon} alt='Back to Home' style={styles.arrow}/>
        </div>
    )
};

const styles: {[key:string]: React.CSSProperties} = {
    arrowContainer: {
        position: 'absolute',
        top: 16,
        right: 16,
        cursor: 'pointer',
    },
    arrow: {
        width: 24,
        height: 24,
    },
};


export default BackArrow;



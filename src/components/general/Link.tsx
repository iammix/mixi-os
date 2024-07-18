import React from 'react';
import { useEffect, useState} from "react";
import { Link as RouterLink, useNavigate, useLocation } from "react-router-dom";

interface LinkProps {
    text: string;
    to: string;
    containerStyle?: React.CSSProperties;
    outsideTo?: string;
}

const Link: React.FC<LinkProps> =(props) => {
    const navigate = useNavigate();

    const location = useLocation();
    const [isHere, setIsHere] = useState(false);

    useEffect(() => {
        if (location.pathname === `${props.to}`) {
            setIsHere(true);
        } else {
            setIsHere(false);
        }
        return ()=> {};
    }, [location, props.to]);

    const [active, setActive] = useState(false);

    const handleClick = (e: any) => {
        let isMounted = true;
        e.preventDefault();
        setActive(true);
        if (location.pathname !== `${props.to}`) {
            setTimeout(()=> {
                if (isMounted) navigate(`/${props.to}`);
            }, 100);
        }
        const t = setTimeout(() => {
            if (isMounted) setActive(false);
        }, 100);

        return () => {
            isMounted = false;
            clearTimeout(t);
        };
    };

    return (
        <RouterLink
            to={`${props.to}`}
            onMouseDown={handleClick}
            style={Object.assign({}, {display: 'flex'}, props.containerStyle)}
        >
            {isHere && <div style={styles.here}/>}
            <h4
                className='router-link'
                style={Object.assign(
                    {},
                    styles.link,
                    active && {color:'red'}
                )}
            >
                {props.text}
            </h4>
        </RouterLink>
    )

}

interface StyleSheetCSS {
    [key: string]: React.CSSProperties;
}


const styles: StyleSheetCSS = {
    link: {
        cursor: 'pointer',
        fontWeight: 'bolder',
        textDecoration: 'underline',
    },
    hereIndicator: {
        width: 4,
        height: 4,
        borderWidth: 3,
        borderStyle: 'solid',
        borderColor: 'rgb(85, 26, 139)',
        alignSelf: 'center',
        borderRadius: '50%',
        marginRight: 6,
        textDecoration: 'none',
    },
};

export default Link;
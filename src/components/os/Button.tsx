import React, { useState } from 'react';
import { IconName } from '../../assets/icons';
import Colors from "../../constants/colors.tsx";
import { Icon } from '../general';

interface ButtonProps {
    icon?: IconName;
    text?: string;
    onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({ icon, text, onClick }) => {
    const [isHovering, setIsHovering] = useState(false);
    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => setIsHovering(false);

    const outerBorderStyle = Object.assign(
        {},
        styles.outerBorder,
        icon && { width: 16, height: 16}
    )
}

interface StyleSheetCSS {
    [key: string]: React.CSSProperties;
}

const styles: StyleSheetCSS = {
    outerBorder: {
        border: `1px solid ${Colors.black}`,
        borderTopColor: Colors.white,
        borderLeftColor: Colors.white,
        background: Colors.lightGray,

        cursor: 'pointer',
    },
    innerBorder: {
        border: `1px solid ${Colors.darkGray}`,
        borderTopColor: Colors.lightGray,
        borderLeftColor: Colors.lightGray,
        flex: 1,
    },
};

export default Button;
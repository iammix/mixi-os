import React, { useCallback, useEffect, useState } from 'react';
import colors from '../../constants/colors';
import { IconName } from '../../assets/icons';
import Showcase from '../apps/Showcase';

export interface DesktopProps {}

type ExtendedWindowAppProps<T> = T & WindowAppProps;

const APPLICATIONS: {
    [key in string]: {
        key: string,
        name: string;
        shortcutIcon:IconName;
        component: React.FC<ExtendedWindowAppProps<any>>;
    };
} = {
    showcase: {
        key: 'showcase',
        name: 'My Life',
        shortcutIcon: 'showcaseIcon', // TODO: Create a new showcaseIcon;
        component: Showcase,
    },
    // TODO: create terminal
/*     terminal: {
        key: 'terminal',
        name: 'mixi-os Terminal',
        shortcutIcon: 'showcaseIcon', // TODO: Create terminal ICON
        component: 
    } */
};


const Desktop: React.FC<DesktopProps> = (props) => {
    const [windows, setWindows] = useState<DesktopWindows>({})
    const [shortcuts, setShortcuts] = useState<DesktopShortcutProps[]>([]);

}


export default Desktop;

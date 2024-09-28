import { createContext, useEffect, useState } from "react";
import { DefaultTheme, ThemeProvider } from "styled-components";
import { useTheme } from "../../hooks/useTheme";
import GlobalStyle from "../../components/styles/GlobalStyle";
import Terminal from "../apps/terminal-components/Terminal";
import useInitialWindowSize from "../../hooks/useInitialWindowSize.tsx";
import Window from '../os/Window.tsx';
import React from 'react';

export const themeContext = createContext<
    ((switchTheme: DefaultTheme) => void) | null
>(null);

export interface TerminalProps extends WindowAppProps {
    onClose: any;
    onInteract: any;
    onMinimize: any;
}

const TerminalApp: React.FC<TerminalProps> = (props) => {
    // themes
    const { initWidth, initHeight } = useInitialWindowSize({ margin: 100 });
    const { theme, themeLoaded, setMode } = useTheme();
    const [selectedTheme, setSelectedTheme] = useState(theme);

    // Disable browser's default behavior
    // to prevent the page go up when Up Arrow is pressed
    useEffect(() => {
        window.addEventListener(
            "keydown",
            e => {
                ["ArrowUp", "ArrowDown"].indexOf(e.code) > -1 && e.preventDefault();
            },
            false
        );
    }, []);

    useEffect(() => {
        setSelectedTheme(theme);
    }, [themeLoaded]);

    // Update meta tag colors when switching themes
    useEffect(() => {
        const themeColor = theme.colors?.body;

        const metaThemeColor = document.querySelector("meta[name='theme-color']");
        const maskIcon = document.querySelector("link[rel='mask-icon']");
        const metaMsTileColor = document.querySelector(
            "meta[name='msapplication-TileColor']"
        );

        metaThemeColor && metaThemeColor.setAttribute("content", themeColor);
        metaMsTileColor && metaMsTileColor.setAttribute("content", themeColor);
        maskIcon && maskIcon.setAttribute("color", themeColor);
    }, [selectedTheme]);

    const themeSwitcher = (switchTheme: DefaultTheme) => {
        setSelectedTheme(switchTheme);
        setMode(switchTheme);
    };

    return (
        <Window
            top={24}
            left={56}
            width={initWidth}
            height={initHeight}
            windowTitle="Konstantinos Mixios - About me"
            windowBarIcon="windowExplorerIcon"
            closeWindow={props.onClose}
            onInteract={props.onInteract}
            minimizeWindow={props.onMinimize}
            bottomLeftText={''}>
            <>
                <h1 className="sr-only" aria-label="Terminal Portfolio">
                    Terminal Portfolio
                </h1>
                {themeLoaded && (
                    <ThemeProvider theme={selectedTheme}>
                        <GlobalStyle theme={undefined} />
                        <themeContext.Provider value={themeSwitcher}>
                            <Terminal />
                        </themeContext.Provider>
                    </ThemeProvider>
                )}
            </>
        </Window>

    );
}

export default TerminalApp;
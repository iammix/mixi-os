import React from 'react';
import useInitialWindowSize from "../../hooks/useInitialWindowSize.tsx";
import Window from '../os/Window.tsx';

export interface TerminalAppProps extends WindowAppProps { }

const TerminalApp: React.FC<TerminalAppProps> = (props) => {
    const { initWidth, initHeight } = useInitialWindowSize({ margin: 100 });

    return (
        <Window
            top={24}
            left={56}
            width={initWidth}
            height={initHeight}
            windowTitle="mixi-OS Terminal"
            windowBarIcon="windowExplorerIcon"
            closeWindow={props.onClose}
            onInteract={props.onInteract}
            minimizeWindow={props.onMinimize}
            bottomLeftText={''}>
            <div className='site-page'>
                <iframe
                    height={'100%'}
                    width={'100%'}
                src={'https://mixios-terminal.vercel.app/'}/>
            </div>
        </Window>
    );
};

export default TerminalApp;

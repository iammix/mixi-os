import React from 'react';
import {Routes, Route} from 'react-router-dom'
import About from "./showcase-components/About.tsx";
import Contact from "./showcase-components/Contact.tsx";
import Home from "./showcase-components/Home.tsx";
import useInitialWindowSize from "../../hooks/useInitialWindowSize.tsx";
import Projects from './showcase-components/Projects.tsx';
import MusicProjects from './showcase-components/projects/Music.tsx';
import Window, {WindowProps} from '../os/Window.tsx';
import SoftwareProjects from "./showcase-components/projects/Software.tsx";
import ProjectDetailPage from './showcase-components/ProjectDetailPage';

export interface ShowcaseProps extends WindowProps {
}

const Showcase: React.FC<ShowcaseProps> = (props) => {
    const {initWidth, initHeight} = useInitialWindowSize({margin: 100});

    return (
        <Window
            top={24}
            left={56}
            width={initWidth}
            height={initHeight}
            windowTitle="Konstantinos Mixios - About me"
            windowBarIcon="windowExplorerIcon"
            closeWindow={props.closeWindow}
            onInteract={props.onInteract}
            minimizeWindow={props.minimizeWindow}
            bottomLeftText={''}>
            <div className='site-page'>
                <Routes>
                    <Route path='/' element={<Home/>}/>
                    <Route path='/about' element={<About/>}/>
                    <Route path='/contact' element={<Contact/>}/>
                    <Route path='/projects' element={<Projects/>}/>
                    <Route path='/projects/:route' element={<ProjectDetailPage />} />
                    <Route path='/projects/music' element={<MusicProjects/>}/>
                    <Route path='/projects/software' element={<SoftwareProjects/>}/>
                    {/* <Route path='/blogposts' element={<PostGrid/>}/> */}
                </Routes>
            </div>
        </Window>
    );
};

export default Showcase;

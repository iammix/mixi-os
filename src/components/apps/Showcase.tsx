import React from 'react';
import {BrowserRouter as Router, Routes, Route} from 'react-router-dom'
import About from "./showcase-components/About.tsx";
import Contact from "./showcase-components/Contact.tsx";
import Home from "./showcase-components/Home.tsx";
import useInitialWindowSize from "../../hooks/useInitialWindowSize.tsx";
import Projects from './showcase-components/Projects.tsx';
import ProjectBox from './showcase-components/ProjectBox.tsx';
import PostGrid from './showcase-components/PostGrid.tsx';
import MusicProjects from './showcase-components/projects/Music.tsx';
import Window from '../os/Window.tsx';
import NavBar from "./showcase-components/NavBar.tsx";
import SoftwareProjects from "./showcase-components/projects/Software.tsx";
import HalfMeeting from './showcase-components/meetings/HalfMeet.tsx';
import MeetingBox from './showcase-components/MeetingBox.tsx';

export interface ShowcaseProps extends WindowAppProps {
}

const Showcase: React.FC<ShowcaseProps> = (props) => {
    const {initWidth, initHeight} = useInitialWindowSize({margin: 500});

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
            <div className='site-page'>
                <Routes>
                    <Route path='/' element={<Home/>}/>
                    <Route path='/about' element={<About/>}/>
                    <Route path='/contact' element={<Contact/>}/>
                    <Route path='/projects' element={<Projects/>}/>
                    <Route path='/projects/:route' element={<ProjectBox/>}/>
                    <Route path='/projects/music' element={<MusicProjects/>}/>
                    <Route path='/projects/projects' element={<SoftwareProjects/>}/>
                    <Route path='/blogposts' element={<PostGrid/>}/>
                </Routes>
            </div>
        </Window>
    );
};

export default Showcase;

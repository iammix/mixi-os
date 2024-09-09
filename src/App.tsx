import './App.css';
import Desktop from './components/os/Desktop';
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

import Contact from "./components/apps/showcase-components/Contact";
import About from "./components/apps/showcase-components/About";
import Showcase from "./components/apps/Showcase";
import Home from "./components/apps/showcase-components/Home";
import PostGrid from './components/apps/showcase-components/PostGrid';
import NavBar from './components/apps/showcase-components/NavBar';
import Projects from './components/apps/showcase-components/Projects';
import ProjectBox from './components/apps/showcase-components/Projects';
import MusicProjects from './components/apps/showcase-components/projects/Music';

function App() {
    return (
        <Router>
            <div className='site-page'>
                <Routes>
                    <Route path='/' element={<Home/>}/>
                    <Route path='/about' element={<About/>}/>
                    <Route path='/contact' element={<Contact/>}/>
                    <Route path='/projects' element={<Projects/>}/>
                    <Route path="/projects/:route" element={<ProjectBox/>} />
                    <Route path='/projects/music' element={<MusicProjects/>}/>
                    <Route path='/blogposts' element={<PostGrid/>}/>
                </Routes>
            </div>
        </Router>
    )
}

export default App

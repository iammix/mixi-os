import './App.css';
// eslint-disable-next-line no-unused-vars
//import React from 'react';
import { BrowserRouter } from 'react-router-dom'

//import Showcase from "./components/apps/Showcase";

//import NavBar from './components/apps/showcase-components/NavBar';

import Desktop from './components/os/Desktop';
import RoomExperience from './components/room/RoomExperience';

function App() {
    return (
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <RoomExperience>
                <Desktop/>
            </RoomExperience>
        </BrowserRouter>
    )
}

export default App

// src/components/showcase-components/ProjectDetailPage.tsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProjectBox from './ProjectBox';
import music from '../../../assets/pictures/projects/music.gif';
import software from '../../../assets/pictures/projects/software.gif';

const ProjectDetailPage: React.FC = () => {
  const { route } = useParams();
  const navigate = useNavigate();

  const projects = {
    music: {
      icon: music,
      title: 'Music',
      subtitle: 'MixVirus Beats',
      route: 'music',
      iconStyle: { width: 48 },
    },
    software: {
      icon: software,
      title: 'Software',
      subtitle: 'Side Projects',
      route: 'software',
      iconStyle: { width: 56 },
    },
  };

  const project = projects[route as keyof typeof projects];

  if (!project) return <div>Project not found</div>;

  return (
    <div className="site-page-content">
      <ProjectBox {...project} navigate={navigate} />
    </div>
  );
};

export default ProjectDetailPage;

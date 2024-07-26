// src/components/PostGrid.js
import React from 'react';
import Post from './Post';
import posts from '../../../assets/posts';

const PostGrid = () => {
  return (
    <div className="post-grid">
      {posts.map(post => (
        <Post key={post.id} title={post.title} content={post.content} />
      ))}
    </div>
  );
};

export default PostGrid;

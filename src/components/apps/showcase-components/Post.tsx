// src/components/Post.js
import React from 'react';

const Post = ({ title, content }) => {
  return (
    <div className="post">
      <p>{content}</p>
    </div>
  );
};

export default Post;

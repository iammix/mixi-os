import { User, WebsiteName, Wrapper } from "../../styles/TerminalInfo.styled";
import React from 'react';
const TermInfo = () => {
  return (
    <Wrapper>
      <User>visitor</User>@<WebsiteName>terminal.satnaing.dev</WebsiteName>:~$
    </Wrapper>
  );
};

export default TermInfo;

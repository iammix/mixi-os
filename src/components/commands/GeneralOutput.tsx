import { Wrapper } from "../styles/Output.styled";
import React from 'react';

type Props = {
  children: string;
};

const GeneralOutput: React.FC<Props> = ({ children }) => (
  <Wrapper>{children}</Wrapper>
);
export default GeneralOutput;

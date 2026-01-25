import React, { createContext, useContext, useState } from 'react';

interface TabBarContextType {
  isTabBarVisible: boolean;
  setTabBarVisible: (visible: boolean) => void;
}

const TabBarContext = createContext<TabBarContextType>({
  isTabBarVisible: true,
  setTabBarVisible: () => {},
});

export const TabBarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  const setTabBarVisible = (visible: boolean) => {
    setIsTabBarVisible(visible);
  };

  return (
    <TabBarContext.Provider value={{ isTabBarVisible, setTabBarVisible }}>
      {children}
    </TabBarContext.Provider>
  );
};

export const useTabBar = () => useContext(TabBarContext);

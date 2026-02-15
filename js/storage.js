// ラスベガス ゴルフ - LocalStorage管理

const Storage = {
  GAME_KEY: 'lasvegas_game',
  CUSTOM_COURSES_KEY: 'lasvegas_custom_courses',

  saveGame(gameState) {
    localStorage.setItem(this.GAME_KEY, JSON.stringify(gameState));
  },

  loadGame() {
    const data = localStorage.getItem(this.GAME_KEY);
    return data ? JSON.parse(data) : null;
  },

  clearGame() {
    localStorage.removeItem(this.GAME_KEY);
  },

  hasSavedGame() {
    return localStorage.getItem(this.GAME_KEY) !== null;
  },

  saveCustomCourse(course) {
    const courses = this.loadCustomCourses();
    const existingIdx = courses.findIndex(c => c.id === course.id);
    if (existingIdx >= 0) {
      courses[existingIdx] = course;
    } else {
      courses.push(course);
    }
    localStorage.setItem(this.CUSTOM_COURSES_KEY, JSON.stringify(courses));
  },

  loadCustomCourses() {
    const data = localStorage.getItem(this.CUSTOM_COURSES_KEY);
    return data ? JSON.parse(data) : [];
  },
};

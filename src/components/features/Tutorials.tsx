import { BookOpen, Play, Clock, Award, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';

export const Tutorials = () => {
  const courses = [
    {
      title: 'Beat Making Fundamentals',
      duration: '45 min',
      level: 'Beginner',
      lessons: 8,
      progress: 60,
      color: 'neon-purple'
    },
    {
      title: 'Melody Creation & Theory',
      duration: '1h 20min',
      level: 'Intermediate',
      lessons: 12,
      progress: 30,
      color: 'neon-cyan'
    },
    {
      title: 'Advanced Mixing Techniques',
      duration: '2h 10min',
      level: 'Advanced',
      lessons: 15,
      progress: 0,
      color: 'neon-pink'
    }
  ];

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Learning Center</h2>
          <p className="text-muted-foreground">Master music production with guided tutorials</p>
        </div>

        {/* Progress Overview */}
        <div className="glass-panel rounded-xl p-6 mb-8">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Award className="w-5 h-5 text-neon-purple" />
                <span className="text-sm text-muted-foreground">Courses Completed</span>
              </div>
              <div className="text-3xl font-bold">3/12</div>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-neon-cyan" />
                <span className="text-sm text-muted-foreground">Total Learning Time</span>
              </div>
              <div className="text-3xl font-bold">8.5h</div>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="w-5 h-5 text-neon-pink" />
                <span className="text-sm text-muted-foreground">Current Streak</span>
              </div>
              <div className="text-3xl font-bold">7 days</div>
            </div>
          </div>
        </div>

        {/* Course List */}
        <div className="space-y-4">
          {courses.map((course, i) => (
            <div key={i} className="glass-panel rounded-xl p-6 hover:border-neon-purple/50 transition-all">
              <div className="flex items-start gap-6">
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br from-${course.color} to-${course.color}/50 flex items-center justify-center flex-shrink-0`}>
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-bold mb-2">{course.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {course.duration}
                        </span>
                        <span>{course.lessons} lessons</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          course.level === 'Beginner' ? 'bg-green-500/20 text-green-400' :
                          course.level === 'Intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {course.level}
                        </span>
                      </div>
                    </div>
                    <Button className={`bg-gradient-to-r from-${course.color} to-${course.color} hover:shadow-lg`}>
                      {course.progress > 0 ? 'Continue' : 'Start Course'}
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                  
                  {course.progress > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold">{course.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-studio-panel rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r from-${course.color} to-${course.color}`}
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Tips */}
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4">Quick Tips</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { title: 'Using Sidechain Compression', duration: '3 min' },
              { title: 'Creating Punchy Kicks', duration: '5 min' },
              { title: 'Layering Melodies', duration: '4 min' },
              { title: 'EQ Basics for Beginners', duration: '6 min' }
            ].map((tip, i) => (
              <div key={i} className="glass-panel rounded-lg p-4 hover:border-neon-cyan/50 transition-all cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-neon-cyan/20 flex items-center justify-center group-hover:bg-neon-cyan/30 transition-all">
                    <Play className="w-5 h-5 text-neon-cyan" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm mb-1">{tip.title}</h4>
                    <span className="text-xs text-muted-foreground">{tip.duration}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

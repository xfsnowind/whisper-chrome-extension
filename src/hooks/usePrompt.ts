import { useCallback } from "react";


export default function usePrompt() {
  const createPromptSession = useCallback(
    async (transcript: string) => {
      // const session = await self.ai.languageModel.create({
      //   systemPrompt: "I will show you news transcript, ask me 5 questions to check my understanding of it. I am 10 years old. the transcript is: " + transcript
      // });
      const session = await self.ai.languageModel.create({
        systemPrompt: `I will show you news transcript, ask me 5 questions to check my understanding of it. I am 10 years old. the transcript is: [0:00] It is not, of
[0:00] course, just the white House
[0:02] up for grabs here in 20 days.
[0:03] Democrats are hanging on
[0:05] to the Senate by a thread.
[0:06] They currently only have a two seat
[0:08] majority, 5149.
[0:09] And that includes four independents
[0:11] who caucus with the Democratic Party.
[0:13] West Virginia
[0:14] all but certain to flip from blue
[0:16] to red come November
[0:17] because of Joe
[0:17] Manchin's decision
[0:19] to retire from the Senate
[0:21] and two competitive Senate seats
[0:22] currently held
[0:23] by Democrats in Ohio and Montana
[0:26] are in states that are,
[0:28] let's be real, red states now.
[0:30] And that makes Democrats
[0:31] path to defending their majority
[0:32] in the upper chamber
[0:33] even more complicated.
[0:35] There is one race, and they are always
[0:38] hopeful about it
[0:39] because of who holds it currently.
[0:41] But this is pretty interesting in Texas
[0:44] because Congressman Cullen,
[0:45] already
[0:46] trying to unseat longtime
[0:47] Republican Senator Ted Cruz.
[0:49] A recent poll showed all red,
[0:51] just four points behind Cruz.
[0:52] Last night,
[0:53] the pair took to the stage to debate.
[0:58] He's never there for us when we need him.
[1:00] When the lights went out
[1:01] and the energy capital of the world.
[1:02] He went to Cancun on January 6th
[1:05] when a mob was storming the Capitol.
[1:07] He was hiding in a supply closet.
[1:09] And when the toughest border security
[1:10] bill in a generation
[1:11] came up in the United States Senate,
[1:12] he took it down.
[1:14] You know what he argued for
[1:15] military bases should have drag shows
[1:18] and should be able to fly
[1:19] a transgender flag above it.
[1:21] Look, call me old fashioned.
[1:22] I think the only flag that should fly
[1:23] above our military base
[1:25] should be the American flag.
[1:27] All right.
[1:27] Joining us now,
[1:28] senior congressional reporter
[1:29] for Punchbowl News. Andrew.
[1:31] Andrew, good morning to you.
[1:33] Look, this is a race.
[1:34] This is not the first time
[1:35] that we've talked about somebody
[1:36] who's challenging Ted Cruz.
[1:37] Democrats are always hopeful about it.
[1:39] Right. it never actually pans out.
[1:41] I will say
[1:42] this is the
[1:43] the time that it's probably the closest.
[1:45] Right.
[1:46] Colin Allred, as a candidate,
[1:48] brings some things to the table
[1:49] that others may not have in the past.
[1:52] and in the right national environment,
[1:53] maybe something might happen there.
[1:56] Why is it so close in Texas right now?
[1:58] Well, it's getting closer and closer
[2:00] each time.
[2:00] Ted Cruz has run for reelection,
[2:02] of course.
[2:02] last time
[2:03] he ran against Beto O'Rourke, a
[2:05] you remember?
[2:06] And he only lost by a few points.
[2:08] That was, of course, a midterm year.
[2:10] In midterm years, we see a much lower
[2:12] voter turnout.
[2:13] Usually we're now in a presidential year.
[2:15] Voter turnout is going to be higher.
[2:17] I think that benefits Ted Cruz here.
[2:19] But again,
[2:19] Colin already is a strong candidate.
[2:22] He is someone that Senate Democrats
[2:24] are very high on.
[2:25] And that is why the Dscc,
[2:27] the Senate Democratic campaign arm,
[2:29] is pumping
[2:30] tons of money right now
[2:31] into Texas to try to go on offense here
[2:34] and look,
[2:34] one of the main reasons
[2:35] they're doing that
[2:36] is because
[2:37] they've got this really slim majority.
[2:38] And, if they lose
[2:40] just one of those battleground states
[2:42] to Republicans, their majority goes poof
[2:44] unless they pick up a seat in Texas
[2:46] or in Florida,
[2:48] which is another state
[2:48] they're trying to compete in,
[2:50] which, again,
[2:50] the odds are pretty slim for them
[2:52] there as well.
[2:53] So so again,
[2:54] this is all about saving their majority
[2:55] there.`
      });
      const result = await session.prompt("ask me first question ");
      const result2 = await session.prompt("because it will show their success, can you judge me answer");
      console.log(transcript)
      console.log(123456, result, result2);    
    },
    [],
  );

  
 return {createPromptSession} 
   
}

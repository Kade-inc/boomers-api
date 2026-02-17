import { Schema, model } from "mongoose";

interface IDomainTopic {
  name: string;
  parentSubdomain: Schema.Types.ObjectId;
}

const domainTopicSchema = new Schema<IDomainTopic>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    parentSubdomain: {
      type: Schema.Types.ObjectId,
      ref: 'TeamSubDomain',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const DomainTopic = model<IDomainTopic>("DomainTopic", domainTopicSchema);

export default DomainTopic;
